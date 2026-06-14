// Force-directed knowledge graph — vanilla JS, SVG, no D3

const NODE_COLORS = {
  STRUCTURE: '#5C4033',
  SPACE:     '#7A6E47',
  ELEMENT:   '#5D1D16',
  SURFACE:   '#A3B4BE',
  RITUAL:    '#D6BDB8',
  COSMO:     '#F6E4A6',
  UNKNOWN:   '#aaa'
};
const EDGE_COLORS = {
  SPATIAL:  '#A3B4BE',
  MATERIAL: '#5C4033',
  RITUAL:   '#5D1D16',
  COSMO:    '#7A6E47',
  SEMANT:   '#D6BDB8',
  PROPO:    '#F6E4A6'
};
const SEL  = '#E53325';
const CATS = ['SPATIAL','MATERIAL','RITUAL','COSMO','SEMANT','PROPO'];

// Physics constants
const REP     = 2800;
const SPRING  = 0.035;
const IDEAL   = 120;
const GRAVITY = 0.0015;
const DAMP    = 0.88;

// Runtime state
let _nodes = [], _edges = [];
let _filter = 'ALL', _sel = null;
let _tx = 0, _ty = 0, _sc = 1;
let _svg = null, _canvas = null, _edgeG = null, _nodeG = null;
let _simAlpha = 0, _rafId = null;
let _ready = false, _loading = false;

// ── Entry ────────────────────────────────────────────────────────────

export function initExplore() {
  if (_ready) { _onShow(); return; }
  if (_loading) return;
  _loading = true;

  const c = document.getElementById('explore-svg-container');
  if (c) c.innerHTML = '<div class="explore-loading"><span class="ln-en">Building graph…</span><span class="ln-uk">Побудова графу…</span></div>';

  _fetchData()
    .then(() => {
      _setupSVG();
      _renderAll();
      // Apply initial positions and center immediately (RAF ensures layout is done)
      requestAnimationFrame(() => {
        _updatePos();
        _centerGraph();
      });
      return _runSim();
    })
    .then(() => { _ready = true; _centerGraph(); })
    .catch(err => {
      console.error('Explore error', err);
      const c2 = document.getElementById('explore-svg-container');
      if (c2) c2.innerHTML = '<div class="explore-loading">Failed to load graph.</div>';
    });
}

function _onShow() {
  requestAnimationFrame(() => _centerGraph());
}

// ── Data ─────────────────────────────────────────────────────────────

async function _fetchData() {
  const [kg, lex, val] = await Promise.all([
    fetch('/data/B4_MASNENKO_2012_kg_merged.json').then(r => r.json()),
    fetch('/data/entities_lexicon.json').then(r => r.json()),
    fetch('/data/validation_results.json').then(r => r.json()),
  ]);

  const lexicon = Object.assign({}, lex);
  delete lexicon._meta;
  const validation = val.per_subject || {};

  const nodeMap = new Map();
  const getNode = id => {
    if (!nodeMap.has(id)) {
      const lx = lexicon[id];
      const angle = Math.random() * Math.PI * 2;
      const radius = 80 + Math.random() * 350;
      nodeMap.set(id, {
        id,
        label_uk: lx?.label_uk || id.replace(/_/g, ' ').toLowerCase(),
        label_en: lx?.label_en || id.replace(/_/g, ' ').toLowerCase(),
        type: lx?.type || 'UNKNOWN',
        untranslatable: !!lx?.untranslatable,
        notes: lx?.notes || '',
        aliases: lx?.aliases || [],
        validation: validation[id] || null,
        degree: 0,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0, vy: 0,
        _el: null, _c: null
      });
    }
    return nodeMap.get(id);
  };

  _edges = kg.edges
    .map(e => ({
      id: e.triple_id,
      source: getNode(e.subject),
      target: getNode(e.object),
      relation: e.relation || '',
      category: e.relation_category || 'SPATIAL',
      evidence: Array.isArray(e.evidence) ? e.evidence : (e.evidence ? [e.evidence] : []),
      _el: null
    }))
    .filter(e => e.source.id !== e.target.id);

  _nodes = [...nodeMap.values()];
  _edges.forEach(e => { e.source.degree++; e.target.degree++; });

  const cnt = document.getElementById('explore-counts');
  if (cnt) cnt.textContent = `${_nodes.length} nodes · ${_edges.length} edges`;
}

// ── Simulation ───────────────────────────────────────────────────────

function _tick(alpha) {
  const N = _nodes.length;

  // Repulsion O(n²)
  for (let i = 0; i < N; i++) {
    const a = _nodes[i];
    for (let j = i + 1; j < N; j++) {
      const b = _nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + 1;
      const d  = Math.sqrt(d2);
      const f  = REP / d2;
      a.vx -= f * dx / d; a.vy -= f * dy / d;
      b.vx += f * dx / d; b.vy += f * dy / d;
    }
  }

  // Springs
  for (const e of _edges) {
    const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    const f  = SPRING * (d - IDEAL) / d;
    e.source.vx += f * dx; e.source.vy += f * dy;
    e.target.vx -= f * dx; e.target.vy -= f * dy;
  }

  // Gravity + integrate
  for (const n of _nodes) {
    n.vx = (n.vx - n.x * GRAVITY) * DAMP;
    n.vy = (n.vy - n.y * GRAVITY) * DAMP;
    n.x += n.vx * alpha;
    n.y += n.vy * alpha;
  }
}

function _runSim() {
  return new Promise(resolve => {
    let alpha = 1.0, ticks = 0;
    const TOTAL = 200, BATCH = 15;

    const step = () => {
      for (let i = 0; i < BATCH && alpha > 0.001; i++) {
        alpha *= 0.986;
        _tick(alpha);
        ticks++;
      }
      if (ticks === BATCH) {
        console.log('First tick — sample position:', _nodes[0]?.id, Math.round(_nodes[0]?.x), Math.round(_nodes[0]?.y));
      }
      _updatePos();
      if (alpha > 0.001 && ticks < TOTAL) {
        setTimeout(step, 0);
      } else {
        _centerGraph();
        // Continue RAF for remainder
        _simAlpha = 0.04;
        _startRaf();
        resolve();
      }
    };
    setTimeout(step, 0);
  });
}

function _startRaf() {
  if (_rafId) return;
  const step = () => {
    if (_simAlpha < 0.001) { _rafId = null; return; }
    _tick(_simAlpha);
    _simAlpha *= 0.985;
    _updatePos();
    _rafId = requestAnimationFrame(step);
  };
  _rafId = requestAnimationFrame(step);
}

// ── SVG ──────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag) => document.createElementNS(NS, tag);

function _setupSVG() {
  const c = document.getElementById('explore-svg-container');
  if (!c) return;
  c.innerHTML = '';

  _svg = svgEl('svg');
  _svg.style.cssText = 'width:100%;height:100%;display:block;cursor:grab;touch-action:none;user-select:none;';

  // Arrow markers
  const defs = svgEl('defs');
  [...CATS, 'SEL'].forEach(cat => {
    const color = cat === 'SEL' ? SEL : (EDGE_COLORS[cat] || '#aaa');
    const m = svgEl('marker');
    m.setAttribute('id', `arr-${cat}`);
    m.setAttribute('markerWidth', '5');
    m.setAttribute('markerHeight', '5');
    m.setAttribute('refX', '4');
    m.setAttribute('refY', '2.5');
    m.setAttribute('orient', 'auto');
    m.setAttribute('markerUnits', 'strokeWidth');
    const p = svgEl('path');
    p.setAttribute('d', 'M0,0 L0,6 L6,3 z');
    p.setAttribute('fill', color);
    m.appendChild(p);
    defs.appendChild(m);
  });
  _svg.appendChild(defs);

  _canvas = svgEl('g');
  _edgeG  = svgEl('g');
  _nodeG  = svgEl('g');
  _canvas.appendChild(_edgeG);
  _canvas.appendChild(_nodeG);
  _svg.appendChild(_canvas);
  c.appendChild(_svg);

  // Set initial transform so canvas isn't stuck at bare (0,0)
  _applyTx();
  _bindPanZoom();
  _bindControls();
  _buildLegend();
}

function _renderAll() {
  if (!_svg) return;
  _edgeG.innerHTML = '';
  _nodeG.innerHTML = '';

  // Edges
  _edges.forEach(e => {
    const path = svgEl('path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', EDGE_COLORS[e.category] || '#aaa');
    path.setAttribute('stroke-width', '1');
    path.setAttribute('opacity', '0.25');
    path.setAttribute('marker-end', `url(#arr-${e.category})`);
    _edgeG.appendChild(path);
    e._el = path;
  });

  // Nodes
  _nodes.forEach(n => {
    const g   = svgEl('g');
    g.dataset.nid = n.id;
    g.style.cursor = 'pointer';
    const r   = _r(n);
    const col = NODE_COLORS[n.type] || '#aaa';

    if (n.untranslatable) {
      const ring = svgEl('circle');
      ring.setAttribute('r', r + 3.5);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', col);
      ring.setAttribute('stroke-width', '1');
      ring.setAttribute('stroke-dasharray', '3,2');
      ring.setAttribute('opacity', '0.7');
      g.appendChild(ring);
    }

    const c = svgEl('circle');
    c.setAttribute('r', r);
    c.setAttribute('fill', col);
    g.appendChild(c);
    n._c = c;

    const lbl = svgEl('text');
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('y', r + 11);
    lbl.setAttribute('font-size', '8');
    lbl.setAttribute('font-family', 'NAMU, sans-serif');
    lbl.setAttribute('fill', '#222');
    lbl.setAttribute('pointer-events', 'none');
    lbl.setAttribute('class', 'exp-lbl');
    lbl.textContent = n.label_uk;
    g.appendChild(lbl);

    g.addEventListener('click', ev => { ev.stopPropagation(); _select(n); });
    g.addEventListener('mouseenter', () => _highlight(n));
    g.addEventListener('mouseleave', _unhighlight);

    _nodeG.appendChild(g);
    n._el = g;
  });
}

function _r(n) {
  return Math.max(4, Math.min(14, 4 + Math.log(Math.max(1, n.degree)) * 2.2));
}

function _updatePos() {
  for (const e of _edges) {
    if (!e._el) continue;
    const sx = e.source.x, sy = e.source.y;
    const tx = e.target.x, ty = e.target.y;
    const dx = tx - sx, dy = ty - sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const r   = _r(e.target);
    // End point sits at node boundary
    const ex  = tx - dx / len * (r + 4);
    const ey  = ty - dy / len * (r + 4);
    // Cubic control point offset perpendicular to edge
    const cx  = (sx + tx) / 2 - dy / len * 16;
    const cy  = (sy + ty) / 2 + dx / len * 16;
    e._el.setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`);
  }
  for (const n of _nodes) {
    if (n._el) n._el.setAttribute('transform', `translate(${n.x},${n.y})`);
  }
}

// ── Pan / Zoom ────────────────────────────────────────────────────────

function _bindPanZoom() {
  let drag = false, ox = 0, oy = 0, stx = 0, sty = 0;

  _svg.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    if (e.target.closest('[data-nid]')) return;
    drag = true;
    ox = e.clientX; oy = e.clientY;
    stx = _tx; sty = _ty;
    _svg.setPointerCapture(e.pointerId);
    _svg.style.cursor = 'grabbing';
  });

  _svg.addEventListener('pointermove', e => {
    if (!drag) return;
    _tx = stx + e.clientX - ox;
    _ty = sty + e.clientY - oy;
    _applyTx();
  });

  _svg.addEventListener('pointerup', () => { drag = false; _svg.style.cursor = 'grab'; });

  _svg.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = _svg.getBoundingClientRect();
    _zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 0.9);
  }, { passive: false });

  _svg.addEventListener('click', e => {
    if (!e.target.closest('[data-nid]')) _select(null);
  });
}

function _zoomAt(mx, my, f) {
  const ns = Math.max(0.1, Math.min(3, _sc * f));
  const r  = ns / _sc;
  _tx = mx - r * (mx - _tx);
  _ty = my - r * (my - _ty);
  _sc = ns;
  _applyTx();
  _lblVis();
}

function _applyTx() {
  if (_canvas) _canvas.setAttribute('transform', `translate(${_tx},${_ty}) scale(${_sc})`);
}

function _centerGraph() {
  if (!_nodes.length) return;
  const cw = _cw(), ch = _ch();
  if (!cw || !ch) { requestAnimationFrame(_centerGraph); return; }

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of _nodes) {
    if (n.x < x0) x0 = n.x; if (n.y < y0) y0 = n.y;
    if (n.x > x1) x1 = n.x; if (n.y > y1) y1 = n.y;
  }
  const gw = (x1 - x0) || 1, gh = (y1 - y0) || 1;
  _sc = Math.max(0.1, Math.min(1.2, Math.min(cw / (gw + 80), ch / (gh + 80))));
  _tx = cw / 2 - ((x0 + x1) / 2) * _sc;
  _ty = ch / 2 - ((y0 + y1) / 2) * _sc;
  if (isNaN(_tx) || isNaN(_ty) || isNaN(_sc)) { _tx = cw/2; _ty = ch/2; _sc = 1; }
  _applyTx();
  _lblVis();
  console.log('_centerGraph —', Math.round(cw), 'x', Math.round(ch), '— scale', _sc.toFixed(3), 'tx', Math.round(_tx), 'ty', Math.round(_ty));
}

function _lblVis() {
  const show = _sc >= 0.4;
  document.querySelectorAll('.exp-lbl').forEach(l => { l.style.display = show ? '' : 'none'; });
}

function _cw() {
  const el = document.getElementById('explore-svg-container');
  return (el?.getBoundingClientRect().width)  || el?.clientWidth  || 800;
}
function _ch() {
  const el = document.getElementById('explore-svg-container');
  return (el?.getBoundingClientRect().height) || el?.clientHeight || 600;
}

// ── Controls ──────────────────────────────────────────────────────────

function _bindControls() {
  document.getElementById('explore-zoom-in')
    ?.addEventListener('click', () => _zoomAt(_cw() / 2, _ch() / 2, 1.2));
  document.getElementById('explore-zoom-out')
    ?.addEventListener('click', () => _zoomAt(_cw() / 2, _ch() / 2, 0.85));
  document.getElementById('explore-zoom-fit')
    ?.addEventListener('click', _centerGraph);

  document.querySelectorAll('.exp-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.exp-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _filter = btn.dataset.filter;
      _applyFilter();
    });
  });

  const search = document.getElementById('explore-search');
  if (search) search.addEventListener('input', () => _applySearch(search.value.trim().toLowerCase()));

  document.getElementById('explore-sheet-close')?.addEventListener('click', () => {
    document.getElementById('explore-sheet')?.classList.remove('open');
    _select(null);
  });
}

// ── Filter + Search ───────────────────────────────────────────────────

function _applyFilter() {
  for (const e of _edges) {
    if (!e._el) continue;
    const vis = _filter === 'ALL' || e.category === _filter;
    e._el.style.display = vis ? '' : 'none';
    if (vis) e._el.setAttribute('opacity', '0.25');
  }
  for (const n of _nodes) {
    if (!n._el) continue;
    if (_filter === 'ALL') { n._el.style.opacity = '1'; continue; }
    const linked = _edges.some(e => e.category === _filter && (e.source === n || e.target === n));
    n._el.style.opacity = linked ? '1' : '0.08';
  }
}

function _applySearch(q) {
  if (!q) { _applyFilter(); return; }
  for (const n of _nodes) {
    if (!n._el) continue;
    const match = n.label_uk.toLowerCase().includes(q)
      || n.label_en.toLowerCase().includes(q)
      || n.id.toLowerCase().includes(q)
      || n.aliases.some(a => a.toLowerCase().includes(q));
    n._el.style.opacity = match ? '1' : '0.06';
  }
}

// ── Selection + Hover ─────────────────────────────────────────────────

function _select(node) {
  _sel = node;

  if (!node) {
    for (const n of _nodes) {
      if (!n._el) continue;
      n._el.style.opacity = '1';
      n._c?.setAttribute('fill', NODE_COLORS[n.type] || '#aaa');
    }
    for (const e of _edges) {
      if (!e._el) continue;
      const vis = _filter === 'ALL' || e.category === _filter;
      e._el.style.display = vis ? '' : 'none';
      e._el.setAttribute('opacity', '0.25');
      e._el.setAttribute('stroke', EDGE_COLORS[e.category] || '#aaa');
      e._el.setAttribute('marker-end', `url(#arr-${e.category})`);
    }
    _updatePanel(null);
    return;
  }

  const connectedIds = new Set([node.id]);
  for (const e of _edges) {
    if (e.source === node) connectedIds.add(e.target.id);
    if (e.target === node) connectedIds.add(e.source.id);
  }

  for (const n of _nodes) {
    if (!n._el) continue;
    const is = n === node;
    n._c?.setAttribute('fill', is ? SEL : (NODE_COLORS[n.type] || '#aaa'));
    n._el.style.opacity = connectedIds.has(n.id) ? '1' : '0.15';
  }

  for (const e of _edges) {
    if (!e._el) continue;
    const rel = e.source === node || e.target === node;
    e._el.style.display = '';
    e._el.setAttribute('opacity', rel ? '1' : '0.04');
    e._el.setAttribute('stroke', rel ? SEL : (EDGE_COLORS[e.category] || '#aaa'));
    e._el.setAttribute('marker-end', rel ? 'url(#arr-SEL)' : `url(#arr-${e.category})`);
  }

  _updatePanel(node);
  document.getElementById('explore-sheet')?.classList.add('open');
  const sc = document.getElementById('explore-sheet-content');
  if (sc) sc.innerHTML = document.getElementById('explore-panel-content')?.innerHTML || '';
}

function _highlight(node) {
  if (_sel) return;
  const ids = new Set([node.id]);
  for (const e of _edges) {
    if (e.source === node) ids.add(e.target.id);
    if (e.target === node) ids.add(e.source.id);
  }
  for (const n of _nodes) {
    if (n._el) n._el.style.opacity = ids.has(n.id) ? '1' : '0.15';
  }
  for (const e of _edges) {
    if (!e._el) continue;
    const rel = e.source === node || e.target === node;
    e._el.setAttribute('opacity', rel ? '1' : '0.04');
    e._el.setAttribute('stroke', rel ? SEL : (EDGE_COLORS[e.category] || '#aaa'));
    e._el.setAttribute('marker-end', rel ? 'url(#arr-SEL)' : `url(#arr-${e.category})`);
  }
}

function _unhighlight() {
  if (_sel) return;
  for (const n of _nodes) { if (n._el) n._el.style.opacity = '1'; }
  for (const e of _edges) {
    if (!e._el) continue;
    const vis = _filter === 'ALL' || e.category === _filter;
    e._el.style.display = vis ? '' : 'none';
    e._el.setAttribute('opacity', '0.25');
    e._el.setAttribute('stroke', EDGE_COLORS[e.category] || '#aaa');
    e._el.setAttribute('marker-end', `url(#arr-${e.category})`);
  }
}

// ── Panel ─────────────────────────────────────────────────────────────

function _updatePanel(node) {
  const panel = document.getElementById('explore-panel-content');
  if (!panel) return;

  if (!node) {
    panel.innerHTML = `<p class="explore-hint">
      <span class="ln-en">Click a node to explore</span>
      <span class="ln-uk">Натисніть вузол для перегляду</span>
    </p>`;
    return;
  }

  const v     = node.validation;
  const total = v ? (v.TRUE || 0) + (v.FALSE || 0) + (v.CONTESTED || 0) : 0;
  const valHtml = v && total ? `
    <div class="exp-val-bar">
      <div class="exp-seg seg-t" style="width:${v.TRUE     / total * 100}%"></div>
      <div class="exp-seg seg-c" style="width:${v.CONTESTED / total * 100}%"></div>
      <div class="exp-seg seg-f" style="width:${v.FALSE    / total * 100}%"></div>
    </div>
    <div class="exp-val-nums">${v.TRUE} true · ${v.CONTESTED} contested · ${v.FALSE} false</div>
  ` : '<p class="exp-dim">No validation data</p>';

  const conns    = _edges.filter(e => e.source === node || e.target === node);
  const connHtml = conns.slice(0, 10).map(e => {
    const other = e.source === node ? e.target : e.source;
    const dir   = e.source === node ? '→' : '←';
    const ev    = (e.evidence[0] || '').replace(/</g, '&lt;');
    return `<div class="exp-conn">
      <div class="exp-conn-head">
        <span class="exp-conn-dir">${dir}</span>
        <span class="exp-conn-rel">${e.relation.replace(/_/g, ' ')}</span>
        <span class="exp-conn-node" data-nid="${other.id}">${other.label_uk}</span>
      </div>
      ${ev ? `<div class="exp-conn-ev">${ev.slice(0, 120)}${ev.length > 120 ? '…' : ''}</div>` : ''}
    </div>`;
  }).join('');

  const badge = node.untranslatable
    ? '<span class="exp-badge">untranslatable</span>'
    : '';

  panel.innerHTML = `
    <button class="exp-close-btn" id="exp-close-btn">✕</button>
    <div class="exp-type">${node.type}</div>
    <h2 class="exp-label-uk">${node.label_uk} ${badge}</h2>
    <div class="exp-label-en">${node.label_en}</div>
    ${node.notes ? `<p class="exp-notes">${node.notes}</p>` : ''}
    <div class="exp-section"><span class="ln-en">Validation</span><span class="ln-uk">Верифікація</span></div>
    ${valHtml}
    <div class="exp-section"><span class="ln-en">Connections (${conns.length})</span><span class="ln-uk">Зв'язки (${conns.length})</span></div>
    <div class="exp-conns">${connHtml || '<p class="exp-dim">No connections</p>'}</div>
    ${conns.length > 10 ? `<p class="exp-dim">+${conns.length - 10} more</p>` : ''}
    ${node.aliases.length ? `
      <div class="exp-section"><span class="ln-en">Aliases</span><span class="ln-uk">Варіанти</span></div>
      <p class="exp-aliases">${node.aliases.slice(0, 8).join(' · ')}</p>
    ` : ''}
  `;

  // Wire up connection node links
  panel.querySelectorAll('.exp-conn-node[data-nid]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const n = _nodes.find(n => n.id === el.dataset.nid);
      if (n) _select(n);
    });
  });

  // Close button
  document.getElementById('exp-close-btn')?.addEventListener('click', () => _select(null));
}

// ── Legend ────────────────────────────────────────────────────────────

function _buildLegend() {
  const el = document.getElementById('explore-legend');
  if (!el) return;
  el.innerHTML = `
    <div class="exp-leg-ttl">Nodes</div>
    ${Object.entries(NODE_COLORS).filter(([k]) => k !== 'UNKNOWN').map(([k, c]) =>
      `<div class="exp-leg-row"><span class="exp-leg-dot" style="background:${c}"></span>${k.toLowerCase()}</div>`
    ).join('')}
    <div class="exp-leg-ttl" style="margin-top:8px">Edges</div>
    ${CATS.map(k =>
      `<div class="exp-leg-row"><span class="exp-leg-line" style="background:${EDGE_COLORS[k]}"></span>${k.toLowerCase()}</div>`
    ).join('')}
  `;
}
