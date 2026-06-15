// Constellation knowledge graph — Canvas, static circular layout, no physics

import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY, forceRadial } from 'd3-force';

const NODE_COLORS = {
  STRUCTURE: '#5C4033',
  SPACE:     '#7A6E47',
  ELEMENT:   '#5D1D16',
  SURFACE:   '#A3B4BE',
  RITUAL:    '#D6BDB8',
  COSMO:     '#F6E4A6',
  UNKNOWN:   '#aaa'
};

const CAT_COLORS = {
  SPATIAL:  '#8BA8B5',
  MATERIAL: '#7A5C3A',
  RITUAL:   '#8B3A35',
  COSMO:    '#6B6535',
  SEMANT:   '#7A6B8E',
  PROPO:    '#9B8E82',
  OTHER:    '#9B8E82'
};

const CATS = ['SPATIAL', 'MATERIAL', 'RITUAL', 'COSMO', 'SEMANT', 'PROPO'];

const MAX_RULE_DOTS = 14; // cap rule dots drawn per entity on canvas (panel still lists all)
const SWIRL_DIST_STEP = 3; // outward distance increment per rule dot
const SWIRL_FAN = 2.3; // angular spread (radians) of the rule-dot fan, facing away from center
const DIAMOND_R = 140; // keep entity circles clear of the center source-label diamond

// ── State ─────────────────────────────────────────────────────────────
let _nodes    = [];   // entity nodes from lexicon
let _edges    = [];   // entity-entity links {source, target, category}
let _elemNodes = [];  // canvas layout positions for entity circles
let _ruleNodes = [];  // canvas layout positions for rule dots
let _selElem  = -1;  // selected entity index
let _selRule  = -1;  // selected rule node index
let _hovElem  = -1;
let _hovRule  = -1;
let _canvas   = null;
let _ctx      = null;
let _filter   = 'ALL';
let _ready    = false;
let _loading  = false;
let _dpr      = 1;
let _ro       = null;
let _cam       = { scale: 1, x: 0, y: 0 };  // current rendered camera
let _camTarget = { scale: 1, x: 0, y: 0 };  // target camera
let _camRAF    = null;
let _pendingSearch = null; // entity query set before explore finished initialising

// ── Entry ─────────────────────────────────────────────────────────────

export function initExplore() {
  if (_ready) { _onShow(); return; }
  if (_loading) return;
  _loading = true;

  const c = document.getElementById('explore-svg-container');
  if (c) c.innerHTML = '<div class="explore-loading"><span class="ln-en">Building graph…</span><span class="ln-uk">Побудова графу…</span></div>';

  _fetchData()
    .then(() => {
      _setupCanvas();
      _buildLayout();
      _draw();
      _ready = true;
      if (_pendingSearch) {
        const q = _pendingSearch; _pendingSearch = null;
        selectEntityByQuery(q);
      }
    })
    .catch(err => {
      console.error('Explore error', err);
      const c2 = document.getElementById('explore-svg-container');
      if (c2) c2.innerHTML = '<div class="explore-loading">Failed to load graph.</div>';
    });
}

function _onShow() {
  _resizeCanvas();
  _buildLayout();
  _draw();
}

// ── Data ──────────────────────────────────────────────────────────────

async function _fetchData() {
  const [kg, lex, val] = await Promise.all([
    fetch('/data/B4_MASNENKO_2012_kg_merged.json').then(r => r.json()),
    fetch('/data/entities_lexicon.json').then(r => r.json()),
    fetch('/data/validation_results.json').then(r => r.json()),
  ]);

  const validation = val.per_subject || {};
  const entityKeys = new Set(Object.keys(lex).filter(k => k !== '_meta'));

  const nodeMap = new Map();
  entityKeys.forEach(id => {
    const lx = lex[id];
    nodeMap.set(id, {
      id,
      label_uk: lx?.label_uk || id.replace(/_/g, ' ').toLowerCase(),
      label_en: lx?.label_en || id.replace(/_/g, ' ').toLowerCase(),
      type: lx?.type || 'UNKNOWN',
      untranslatable: !!lx?.untranslatable,
      notes: lx?.notes || '',
      aliases: lx?.aliases || [],
      validation: validation[id] || null,
      rules: [],   // ALL KG triples where this entity is subject
      degree: 0
    });
  });

  // Collect ALL rules per entity (object need not be a lexicon key)
  kg.edges.filter(e => entityKeys.has(e.subject)).forEach(e => {
    const node = nodeMap.get(e.subject);
    if (!node) return;
    const ev = Array.isArray(e.evidence) ? (e.evidence[0] || '') : (e.evidence || '');
    node.rules.push({
      rel: e.relation || '',
      obj: e.object || '',
      cat: e.relation_category || 'SPATIAL',
      ev
    });
  });

  // Entity-entity edges (constellation spokes)
  const filteredEdges = kg.edges.filter(
    e => entityKeys.has(e.subject) && entityKeys.has(e.object) && e.subject !== e.object
  );

  // Include nodes that have rules OR appear in entity-entity edges
  const usedKeys = new Set();
  filteredEdges.forEach(e => { usedKeys.add(e.subject); usedKeys.add(e.object); });
  nodeMap.forEach((n, k) => { if (n.rules.length) usedKeys.add(k); });

  _nodes = Array.from(entityKeys)
    .filter(id => usedKeys.has(id))
    .map(id => nodeMap.get(id))
    .filter(Boolean);

  const nIdx = new Map(_nodes.map((n, i) => [n.id, i]));

  _edges = filteredEdges
    .map(e => ({
      source:   nIdx.get(e.subject),
      target:   nIdx.get(e.object),
      category: e.relation_category || 'SPATIAL'
    }))
    .filter(e => e.source !== undefined && e.target !== undefined);

  _edges.forEach(e => { _nodes[e.source].degree++; _nodes[e.target].degree++; });

  const cnt = document.getElementById('explore-counts');
  if (cnt) cnt.textContent = `${_nodes.length} nodes · ${_edges.length} connections`;
  console.log('Entities:', _nodes.length, 'Links:', _edges.length,
    'Total rules:', _nodes.reduce((s, n) => s + n.rules.length, 0));
}

// ── Canvas setup ──────────────────────────────────────────────────────

function _setupCanvas() {
  const c = document.getElementById('explore-svg-container');
  if (!c) return;
  c.innerHTML = '';

  _dpr = window.devicePixelRatio || 1;
  _canvas = document.createElement('canvas');
  _canvas.style.cssText = 'width:100%;height:100%;display:block;cursor:default;touch-action:none;';
  c.appendChild(_canvas);
  _ctx = _canvas.getContext('2d');

  _resizeCanvas();
  _bindEvents();
  _bindControls();
  _buildLegend();

  if (_ro) _ro.disconnect();
  _ro = new ResizeObserver(() => { _resizeCanvas(); _buildLayout(); _draw(); });
  _ro.observe(c);
}

function _resizeCanvas() {
  const c = document.getElementById('explore-svg-container');
  if (!c || !_canvas) return;
  const rect = c.getBoundingClientRect();
  const w = rect.width  || c.clientWidth  || 800;
  const h = rect.height || c.clientHeight || 600;
  _canvas.width  = Math.round(w * _dpr);
  _canvas.height = Math.round(h * _dpr);
  _ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
}

function _cw() { return _canvas ? _canvas.width  / _dpr : 800; }
function _ch() { return _canvas ? _canvas.height / _dpr : 600; }

// ── Camera (zoom/pan to selection) ──────────────────────────────────────

function _setCameraTarget(scale, x, y) {
  _camTarget = { scale, x, y };
  if (!_camRAF) _camRAF = requestAnimationFrame(_animateCamera);
}

function _animateCamera() {
  const t = 0.18;
  _cam.scale += (_camTarget.scale - _cam.scale) * t;
  _cam.x     += (_camTarget.x     - _cam.x)     * t;
  _cam.y     += (_camTarget.y     - _cam.y)     * t;
  _draw();
  const done = Math.abs(_camTarget.scale - _cam.scale) < 0.001
    && Math.abs(_camTarget.x - _cam.x) < 0.3
    && Math.abs(_camTarget.y - _cam.y) < 0.3;
  if (!done) {
    _camRAF = requestAnimationFrame(_animateCamera);
  } else {
    _cam = { ..._camTarget };
    _camRAF = null;
    _draw();
  }
}

function _toWorld(mx, my) {
  const w = _cw(), h = _ch();
  return [(mx - w / 2) / _cam.scale + _cam.x, (my - h / 2) / _cam.scale + _cam.y];
}

function _zoomToEntity(ei) {
  const en     = _elemNodes[ei];
  const swirlR = _swirlR(en.node);
  const scale  = Math.min(2.4, Math.max(1.3, 120 / swirlR));
  _setCameraTarget(scale, en.x, en.y);
}

function _resetCamera() {
  _setCameraTarget(1, _cw() / 2, _ch() / 2);
}

// ── Layout ────────────────────────────────────────────────────────────

function _elemR(n) {
  return Math.max(14, Math.min(30, 10 + n.label_uk.length * 1.6));
}

// Radius of the full rule-dot swirl around an entity (used for layout spacing)
function _swirlR(n) {
  const cap = Math.min(n.rules.length, MAX_RULE_DOTS);
  if (!cap) return _elemR(n);
  return _elemR(n) + 14 + (cap - 1) * SWIRL_DIST_STEP;
}

function _buildLayout() {
  if (!_nodes.length) return;
  const cw = _cw(), ch = _ch();
  const cx = cw / 2, cy = ch / 2;

  _cam = { scale: 1, x: cx, y: cy };
  _camTarget = { scale: 1, x: cx, y: cy };
  if (_camRAF) { cancelAnimationFrame(_camRAF); _camRAF = null; }

  // Deterministic scattered starting positions across the full canvas (organic clustering,
  // not a ring) — d3-force then pulls connected nodes into loose clusters from here
  const pos = _nodes.map((n, i) => {
    const a1 = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    const a2 = Math.sin(i * 78.233  + 1.7321) * 12543.6789;
    const rx = a1 - Math.floor(a1); // pseudo-random 0..1
    const ry = a2 - Math.floor(a2);
    return { x: cx + (rx - 0.5) * cw * 0.9, y: cy + (ry - 0.5) * ch * 0.9 };
  });

  const radii  = _nodes.map(n => _elemR(n));
  const swirls = _nodes.map(n => _swirlR(n));
  const maxRules = Math.max(1, ..._nodes.map(n => n.rules.length));
  const spread   = Math.min(cw, ch) * 0.68;

  // d3-force relaxation: repulsion + edge springs + collision (no-overlap) + weak centering
  const simNodes = _nodes.map((n, i) => ({ x: pos[i].x, y: pos[i].y, r: radii[i], sr: swirls[i], rc: n.rules.length }));
  const simLinks = _edges.map(e => ({ source: e.source, target: e.target }));

  const sim = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-150))
    .force('link', forceLink(simLinks).distance(d => d.source.sr + d.target.sr + 40).strength(0.4))
    .force('collide', forceCollide(d => d.sr + 18).iterations(3))
    .force('x', forceX(cx).strength(0.0025))
    .force('y', forceY(cy).strength(0.01))
    // Ripple out from the center title: busy (8+ rule) nodes drift toward the outer edge,
    // quieter nodes settle closer in
    .force('radial', forceRadial(
      d => DIAMOND_R + 40 + (d.rc / maxRules) * spread,
      cx, cy
    ).strength(0.22))
    .stop();

  for (let i = 0; i < 400; i++) sim.tick();

  // Fit the relaxed layout into the canvas with a margin
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  simNodes.forEach((p, i) => {
    const pad = swirls[i] + 16; // leave room for full rule-dot swirls
    minX = Math.min(minX, p.x - pad); maxX = Math.max(maxX, p.x + pad);
    minY = Math.min(minY, p.y - pad); maxY = Math.max(maxY, p.y + pad);
  });
  const bw    = maxX - minX || 1, bh = maxY - minY || 1;
  const scale = Math.min((cw * 0.96) / bw, (ch * 0.96) / bh);
  const ox    = cx - ((minX + maxX) / 2) * scale;
  const oy    = cy - ((minY + maxY) / 2) * scale;

  _elemNodes = _nodes.map((n, i) => ({
    x: simNodes[i].x * scale + ox,
    y: simNodes[i].y * scale + oy,
    node: n, idx: i
  }));

  // Push any node that landed too close to the center title/diamond outward (the diamond
  // is always drawn at canvas center, which the relaxed+fitted layout doesn't account for)
  const clearR = DIAMOND_R * scale;
  _elemNodes.forEach(en => {
    const dx = en.x - cx, dy = en.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = clearR + _elemR(en.node);
    if (dist < minDist) {
      const ang = dist > 0.01 ? Math.atan2(dy, dx) : en.idx * 2.399;
      en.x = cx + Math.cos(ang) * minDist;
      en.y = cy + Math.sin(ang) * minDist;
    }
  });

  // Resolve any new overlaps introduced by the diamond-clearance push above
  for (let iter = 0; iter < 6; iter++) {
    for (let i = 0; i < _elemNodes.length; i++) {
      for (let j = i + 1; j < _elemNodes.length; j++) {
        const a = _elemNodes[i], b = _elemNodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = _elemR(a.node) + _elemR(b.node) + 6;
        if (dist < minDist) {
          if (dist < 0.01) dist = 0.01;
          const overlap = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          a.x -= ux * overlap; a.y -= uy * overlap;
          b.x += ux * overlap; b.y += uy * overlap;
        }
      }
    }
  }

  // Rule dots: logarithmic-spiral "swirl" placement around each hub
  _ruleNodes = [];
  _elemNodes.forEach((en, ei) => {
    const rules = en.node.rules;
    const nr    = rules.length;
    if (!nr) { en.extraRules = 0; return; }

    // Cap rule dots drawn on canvas; sample evenly across the full list for category diversity
    const cap   = Math.min(nr, MAX_RULE_DOTS);
    en.extraRules = nr - cap;

    // Fan rule dots away from the center (diamond), spread across SWIRL_FAN radians
    const outAng   = Math.atan2(en.y - cy, en.x - cx) || (ei * 2.399);
    const baseDist = _elemR(en.node) + 14;

    for (let pi = 0; pi < cap; pi++) {
      const ri   = Math.floor(pi * nr / cap);
      const r    = rules[ri];
      const t    = cap > 1 ? pi / (cap - 1) : 0.5;
      const ang  = outAng - SWIRL_FAN / 2 + t * SWIRL_FAN;
      const dist = baseDist + pi * SWIRL_DIST_STEP;
      let rx = Math.max(10, Math.min(cw - 10, en.x + dist * Math.cos(ang)));
      let ry = Math.max(10, Math.min(ch - 10, en.y + dist * Math.sin(ang)));

      // Push the dot clear of any entity circle it would otherwise land inside
      _elemNodes.forEach(other => {
        if (other === en) return;
        const odx = rx - other.x, ody = ry - other.y;
        const od  = Math.sqrt(odx * odx + ody * ody);
        const minD = _elemR(other.node) + 4;
        if (od < minD) {
          const oa = od > 0.01 ? Math.atan2(ody, odx) : ang;
          rx = other.x + Math.cos(oa) * minD;
          ry = other.y + Math.sin(oa) * minD;
        }
      });

      // Deterministic jitter (stable across redraws)
      const jx   = Math.sin(ei * 13.7 + pi * 7.31) * 4;
      const jy   = Math.cos(ei * 11.3 + pi * 5.17) * 4;
      const cpx  = (en.x + rx) / 2 + jx;
      const cpy  = (en.y + ry) / 2 + jy;
      const lbl  = r.obj.length > 18 ? r.obj.slice(0, 16) + '…' : r.obj;
      const dx   = rx - en.x, dy2 = ry - en.y;
      const dl   = Math.sqrt(dx * dx + dy2 * dy2) || 1;

      _ruleNodes.push({
        x: rx, y: ry, cpx, cpy,
        ex: en.x, ey: en.y,
        rule: r, ei, origRi: ri, pi, lbl,
        lx: rx + (dx / dl) * 10,
        ly: ry + (dy2 / dl) * 10,
        align: rx > cx ? 'left' : 'right'
      });
    }
  });
}

// ── Draw ──────────────────────────────────────────────────────────────

function _draw() {
  if (!_ctx || !_canvas) return;
  const w = _cw(), h = _ch();
  const cx = w / 2, cy = h / 2;
  const hasSel = _selElem >= 0;
  const ctx = _ctx;
  ctx.clearRect(0, 0, w, h);

  const neighborSet = hasSel ? new Set(_edges.flatMap(e =>
    e.source === _selElem ? [e.target] : e.target === _selElem ? [e.source] : []
  )) : null;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(_cam.scale, _cam.scale);
  ctx.translate(-_cam.x, -_cam.y);

  // 1. Entity-to-entity links
  _edges.forEach(e => {
    const ea = _elemNodes[e.source], eb = _elemNodes[e.target];
    if (!ea || !eb) return;
    const catOk  = _filter === 'ALL' || e.category === _filter;
    const inSel  = !hasSel || _selElem === e.source || _selElem === e.target;
    const active = inSel && catOk;
    const col    = CAT_COLORS[e.category] || CAT_COLORS.OTHER;
    const cpx    = (ea.x + eb.x) / 2 + (eb.y - ea.y) * 0.12;
    const cpy    = (ea.y + eb.y) / 2 - (eb.x - ea.x) * 0.12;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.globalAlpha = active ? (hasSel ? 0.4 : 0.18) : 0.04;
    ctx.lineWidth   = active ? 1.2 : 0.5;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ea.x, ea.y); ctx.quadraticCurveTo(cpx, cpy, eb.x, eb.y); ctx.stroke();
    ctx.restore();
  });

  // 2. Rule lines (only for the selected entity)
  if (hasSel) _ruleNodes.forEach((rn, i) => {
    if (rn.ei !== _selElem) return;
    const isRuleSel = _selRule === i;
    const catOk     = _filter === 'ALL' || rn.rule.cat === _filter;
    const col       = CAT_COLORS[rn.rule.cat] || CAT_COLORS.OTHER;
    ctx.save();
    ctx.strokeStyle  = col;
    ctx.globalAlpha  = isRuleSel ? 0.9 : catOk ? 0.45 : 0.03;
    ctx.lineWidth    = isRuleSel ? 1.1 : 0.5;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(rn.ex, rn.ey); ctx.quadraticCurveTo(rn.cpx, rn.cpy, rn.x, rn.y); ctx.stroke();
    ctx.restore();
  });

  // 3. Rule dots — uniform density everywhere; selected/hovered dot pops
  _ruleNodes.forEach((rn, i) => {
    const col = CAT_COLORS[rn.rule.cat] || CAT_COLORS.OTHER;
    const isRuleSel = rn.ei === _selElem && _selRule === i;
    const isHovR    = rn.ei === _selElem && _hovRule === i;
    const r     = (isRuleSel || isHovR) ? 5 : 2;
    const alpha = (isRuleSel || isHovR) ? 1 : 0.25;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = col;
    ctx.beginPath(); ctx.arc(rn.x, rn.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // 4. Entity circles
  _elemNodes.forEach((en, ei) => {
    const isSel = _selElem === ei;
    const isHov = _hovElem === ei;
    const n     = en.node;
    const r     = _elemR(n);
    const col   = NODE_COLORS[n.type] || '#5D1D16';
    const isNeighbor  = hasSel && neighborSet.has(ei);
    const sizeAlpha   = Math.max(0.78, 1 - (r - 14) / 16 * 0.22); // smaller nodes render more solid
    const circleAlpha = hasSel ? (isSel ? 1 : isNeighbor ? 0.35 : 0.12) : (isHov ? 1 : sizeAlpha);
    const labelAlpha  = hasSel ? (isSel ? 1 : isNeighbor ? 0.6  : 0.08) : circleAlpha;
    ctx.save();
    ctx.globalAlpha = circleAlpha;
    ctx.fillStyle   = col;
    ctx.beginPath(); ctx.arc(en.x, en.y, r + (isSel ? 1.5 : 0), 0, Math.PI * 2); ctx.fill();
    if (isSel) { ctx.strokeStyle = '#0A0A0A'; ctx.lineWidth = 2.5; ctx.stroke(); }
    ctx.fillStyle    = '#F5F2ED';
    const fs         = r > 22 ? 8.5 : r > 16 ? 7.5 : 7;
    ctx.font         = `500 ${fs}px NAMU, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = labelAlpha;
    ctx.fillText(n.label_uk, en.x, en.y);
    ctx.restore();

    // "+N more" indicator below selected circle when rules are truncated
    if (isSel && en.extraRules > 0) {
      ctx.save();
      ctx.globalAlpha  = 0.6;
      ctx.fillStyle    = '#9B8E82';
      ctx.font         = '400 8px NAMU, sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`+${en.extraRules} more`, en.x, en.y + r + 6);
      ctx.restore();
    }
  });

  // 5. Source diamond
  const sr = 9;
  ctx.save();
  ctx.globalAlpha = hasSel ? 0.4 : 0.75;
  ctx.fillStyle   = '#E8E0D0'; ctx.strokeStyle = '#9B8E82'; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy - sr); ctx.lineTo(cx + sr, cy);
  ctx.lineTo(cx, cy + sr); ctx.lineTo(cx - sr, cy);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle    = '#7A6B5A';
  ctx.globalAlpha  = hasSel ? 0.4 : 0.85;
  ctx.font         = '400 6.5px NAMU, sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('B4 Masnenko 2012', cx, cy + sr + 3);
  ctx.restore();

  ctx.restore(); // camera transform
}

// ── Hit testing + events ──────────────────────────────────────────────

function _mousePos(e) {
  if (!_canvas) return [0, 0];
  const rect = _canvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * ((_canvas.width / _dpr) / rect.width),
    (e.clientY - rect.top)  * ((_canvas.height / _dpr) / rect.height)
  ];
}

function _bindEvents() {
  if (!_canvas) return;

  _canvas.addEventListener('click', e => {
    const [sx, sy] = _mousePos(e);
    const [mx, my] = _toWorld(sx, sy);

    // Rule dot hit (only when an entity is selected)
    if (_selElem >= 0) {
      let hitRule = -1;
      _ruleNodes.forEach((rn, i) => {
        if (rn.ei !== _selElem) return;
        const dx = mx - rn.x, dy = my - rn.y;
        if (dx * dx + dy * dy < 144) hitRule = i;
      });
      if (hitRule >= 0) {
        _selRule = _selRule === hitRule ? -1 : hitRule;
        _highlightPanelRule(_selRule);
        _draw();
        return;
      }
    }

    // Entity node hit
    let hitElem = -1;
    _elemNodes.forEach((en, ei) => {
      const r = _elemR(en.node) + 5;
      const dx = mx - en.x, dy = my - en.y;
      if (dx * dx + dy * dy < r * r) hitElem = ei;
    });

    if (hitElem >= 0) {
      if (_selElem === hitElem) {
        _selElem = -1; _selRule = -1; _updatePanel(-1);
        _resetCamera();
      } else {
        _selElem = hitElem; _selRule = -1; _updatePanel(hitElem);
        _zoomToEntity(hitElem);
      }
    } else {
      _selElem = -1; _selRule = -1; _updatePanel(-1);
      _resetCamera();
    }
    _draw();
  });

  _canvas.addEventListener('mousemove', e => {
    const [sx, sy] = _mousePos(e);
    const [mx, my] = _toWorld(sx, sy);
    let fe = -1, fr = -1;
    _elemNodes.forEach((en, ei) => {
      const r = _elemR(en.node) + 5;
      const dx = mx - en.x, dy = my - en.y;
      if (dx * dx + dy * dy < r * r) fe = ei;
    });
    if (_selElem >= 0) {
      _ruleNodes.forEach((rn, i) => {
        if (rn.ei !== _selElem) return;
        const dx = mx - rn.x, dy = my - rn.y;
        if (dx * dx + dy * dy < 100) fr = i;
      });
    }
    const changed = fe !== _hovElem || fr !== _hovRule;
    _hovElem = fe; _hovRule = fr;
    if (changed) {
      _canvas.style.cursor = (fe >= 0 || fr >= 0) ? 'pointer' : 'default';
      _draw();
    }
  });

  _canvas.addEventListener('mouseleave', () => { _hovElem = -1; _hovRule = -1; _draw(); });
}

// ── Panel ─────────────────────────────────────────────────────────────

function _updatePanel(ei) {
  const panel = document.getElementById('explore-panel-content');
  if (!panel) return;

  if (ei < 0) {
    panel.innerHTML = `<p class="explore-hint">
      <span class="ln-en">Click a node to explore its rules</span>
      <span class="ln-uk">Натисніть вузол для перегляду</span>
    </p>`;
    return;
  }

  const n = _nodes[ei];
  if (!n) return;

  const v     = n.validation;
  const total = v ? (v.TRUE || 0) + (v.FALSE || 0) + (v.CONTESTED || 0) : 0;
  const valHtml = v && total ? `
    <div class="exp-val-bar">
      <div class="exp-seg seg-t" style="width:${v.TRUE / total * 100}%"></div>
      <div class="exp-seg seg-c" style="width:${v.CONTESTED / total * 100}%"></div>
      <div class="exp-seg seg-f" style="width:${v.FALSE / total * 100}%"></div>
    </div>
    <div class="exp-val-nums">${v.TRUE} true · ${v.CONTESTED} contested · ${v.FALSE} false</div>
  ` : '';

  const rules    = n.rules;
  const rulesHtml = rules.map((r, ri) => {
    const col      = CAT_COLORS[r.cat] || CAT_COLORS.OTHER;
    const catMatch = _filter === 'ALL' || r.cat === _filter;
    const ev       = r.ev.replace(/</g, '&lt;');
    return `<div class="prule${catMatch ? '' : ' prule-dim'}" data-orig-ri="${ri}">
      <div class="prule-triple" style="color:${col}">
        ${n.label_uk.toUpperCase()} → ${r.rel.replace(/_/g, ' ')} → <span class="prule-obj">${r.obj}</span>
      </div>
      <div class="prule-ev">«${ev.slice(0, 160)}${ev.length > 160 ? '…' : ''}»</div>
      <div class="prule-cat" style="color:${col}">${r.cat.toLowerCase()}</div>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <button class="exp-close-btn" id="exp-close-btn">✕</button>
    <div class="exp-type">${n.type}</div>
    <h2 class="exp-label-uk">${n.label_uk}</h2>
    <div class="exp-label-en">${n.label_en}</div>
    ${n.notes ? `<p class="exp-notes">${n.notes}</p>` : ''}
    ${valHtml}
    <div class="exp-section">
      <span class="ln-en">Rules (${rules.length})</span>
      <span class="ln-uk">Правила (${rules.length})</span>
    </div>
    <div class="exp-conns" id="prule-list">${rulesHtml || '<p class="exp-dim">No rules</p>'}</div>
  `;

  document.getElementById('exp-close-btn')?.addEventListener('click', () => {
    _selElem = -1; _selRule = -1; _updatePanel(-1); _resetCamera(); _draw();
  });

  panel.querySelectorAll('.prule').forEach(el => {
    el.addEventListener('click', () => {
      const origRi = parseInt(el.dataset.origRi);
      const rni    = _ruleNodes.findIndex(rn => rn.ei === _selElem && rn.origRi === origRi);
      if (_selRule === rni) {
        _selRule = -1;
        panel.querySelectorAll('.prule').forEach(p => p.classList.remove('active'));
      } else {
        _selRule = rni;
        panel.querySelectorAll('.prule').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
      }
      _draw();
    });
  });

  // Mobile sheet sync
  document.getElementById('explore-sheet')?.classList.add('open');
  const sc = document.getElementById('explore-sheet-content');
  if (sc) sc.innerHTML = panel.innerHTML;
}

function _highlightPanelRule(rni) {
  const panel = document.getElementById('explore-panel-content');
  if (!panel) return;
  panel.querySelectorAll('.prule').forEach(el => el.classList.remove('active'));
  if (rni < 0) return;
  const origRi = _ruleNodes[rni]?.origRi;
  const el     = panel.querySelector(`.prule[data-orig-ri="${origRi}"]`);
  if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

// ── Controls ──────────────────────────────────────────────────────────

function _bindControls() {
  document.querySelectorAll('.exp-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.exp-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _filter  = btn.dataset.filter;
      _selRule = -1;
      if (_selElem >= 0) _updatePanel(_selElem);
      _draw();
    });
  });

  const search = document.getElementById('explore-search');
  if (search) search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    if (!q) { _draw(); return; }
    const idx = _nodes.findIndex(n =>
      n.label_uk.toLowerCase().includes(q) ||
      n.label_en.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q) ||
      n.aliases.some(a => a.toLowerCase().includes(q))
    );
    if (idx >= 0) { _selElem = idx; _selRule = -1; _updatePanel(idx); _zoomToEntity(idx); _draw(); }
  });

  // Fit button → rebuild layout
  document.getElementById('explore-zoom-fit')
    ?.addEventListener('click', () => { _buildLayout(); _draw(); });

  document.getElementById('explore-sheet-close')?.addEventListener('click', () => {
    document.getElementById('explore-sheet')?.classList.remove('open');
    _selElem = -1; _selRule = -1; _updatePanel(-1); _resetCamera(); _draw();
  });
}

// ── External API ──────────────────────────────────────────────────────

export function selectEntityByQuery(q) {
  if (!q) return;
  const ql = q.toLowerCase();
  if (!_ready) { _pendingSearch = ql; return; }
  const idx = _nodes.findIndex(n =>
    n.label_uk.toLowerCase().includes(ql) ||
    n.label_en.toLowerCase().includes(ql) ||
    n.id.toLowerCase().includes(ql) ||
    n.aliases.some(a => a.toLowerCase().includes(ql))
  );
  if (idx >= 0) {
    _selElem = idx; _selRule = -1;
    _updatePanel(idx);
    _zoomToEntity(idx);
    _draw();
  }
}

// ── Legend ────────────────────────────────────────────────────────────

function _buildLegend() {
  const el = document.getElementById('explore-legend');
  if (!el) return;
  el.innerHTML = `
    <div class="exp-leg-ttl">Node types</div>
    ${Object.entries(NODE_COLORS).filter(([k]) => k !== 'UNKNOWN').map(([k, c]) =>
      `<div class="exp-leg-row"><span class="exp-leg-dot" style="background:${c}"></span>${k.toLowerCase()}</div>`
    ).join('')}
    <div class="exp-leg-ttl" style="margin-top:8px">Relations</div>
    ${CATS.map(k =>
      `<div class="exp-leg-row"><span class="exp-leg-dot" style="background:${CAT_COLORS[k]}"></span>${k.toLowerCase()}</div>`
    ).join('')}
  `;
}
