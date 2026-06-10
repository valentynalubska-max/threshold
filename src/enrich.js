const SUBJECT_MAP = {
  'pich': 'PICH_STOVE', 'stove': 'PICH_STOVE', 'піч': 'PICH_STOVE', 'oven': 'PICH_STOVE',
  'svolok': 'SVOLOK', 'beam': 'SVOLOK', 'ceiling beam': 'SVOLOK', 'сволок': 'SVOLOK',
  'dolivka': 'DOLIVKA', 'floor': 'DOLIVKA', 'долівка': 'DOLIVKA',
  'pobilka': 'POBILKA', 'whitewash': 'POBILKA', 'побілка': 'POBILKA',
  'wall': 'WALL', 'walls': 'WALL', 'стіна': 'WALL', 'ornament': 'ORNAMENTAL_FRIEZE',
  'fresco': 'ORNAMENTAL_FRIEZE', 'painting': 'ORNAMENTAL_FRIEZE', 'розпис': 'ORNAMENTAL_FRIEZE',
  'table': 'TABLE', 'стіл': 'TABLE',
  'bench': 'BENCH_LAVA', 'лавка': 'BENCH_LAVA', 'лава': 'LAVA',
  'chimney': 'KOMYN_CHIMNEY', 'комин': 'KOMYN_CHIMNEY',
  'textile': 'WOVEN_TEXTILE', 'cloth': 'WOVEN_TEXTILE', 'рушник': 'WOVEN_TEXTILE',
  'ceiling': 'CEILING', 'стеля': 'CEILING',
};

const offlineTerms = {
  'піч':    'central clay-and-brick stove; ritual heart of the khata [structural]',
  'сволок': 'main ceiling beam; cosmologically aligned with the Milky Way [structural]',
  'долівка':'clay-beaten floor; protective against malevolent forces [material]',
  'побілка':'lime wash on interior and exterior walls [material]',
  'сіни':   'unheated entrance vestibule; thermal buffer [spatial]',
  'покуть': 'sacred corner with icon shelf; opposite the stove [ritual]',
  'комин':  'chimney; clay-plastered framework [structural]',
  'розпис': 'ornamental painting on walls, stove, and beams [decorative]',
  'хата':   'traditional Ukrainian vernacular dwelling [spatial]',
  'лавка':  'built-in bench along walls [structural]',
  'груба':  'variant name for the stove structure [structural]',
};

let rulesCache = null;

async function loadRules() {
  if (rulesCache) return rulesCache;
  const res = await fetch('/data/rules.json');
  rulesCache = await res.json();
  return rulesCache;
}

function detectSubjects(text) {
  const lower = text.toLowerCase();
  const subjects = new Set();
  for (const [keyword, subject] of Object.entries(SUBJECT_MAP)) {
    if (lower.includes(keyword)) subjects.add(subject);
  }
  return [...subjects];
}

function filterRules(allRules, subjects) {
  return allRules.filter(r =>
    r.human_tag === 'TRUE' &&
    r.status === 'KEPT' &&
    subjects.includes(r.subject)
  ).map(r => ({
    id: r.id,
    subject: r.subject,
    relation: r.relation,
    object: r.object,
    evidence: r.evidence,
    source_ref: r.source_ref,
    page_number: r.source_ref
      ? parseInt(r.source_ref.replace(/.*_p0*/, ''), 10) || null
      : null,
  }));
}

function renderEnriched(enrichedText, additions) {
  let html = escHtml(enrichedText);

  const sorted = [...additions].sort((a, b) => b.phrase.length - a.phrase.length);

  for (const add of sorted) {
    const page = add.page_number ? `Masnenko p.${add.page_number}` : add.source_ref || add.rule_id;
    const tip = escAttr(`${page} · ${add.rule_id}`);
    const escaped = escHtml(add.phrase);
    html = html.replace(escaped, `<span class="enriched-term" data-tip="${tip}">${escaped}</span>`);
  }

  document.getElementById('enrichOut').innerHTML = html;
}

export function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escAttr(s) {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function offlineEnrich(text) {
  let out = escHtml(text);
  for (const [t, d] of Object.entries(offlineTerms)) {
    out = out.replace(new RegExp(`(${t})`, 'gi'), `<span class="enriched-term" data-tip="${d}">$1</span>`);
  }
  document.getElementById('enrichOut').innerHTML = out;
}

export async function runEnrich() {
  const text = document.getElementById('enrichIn').value.trim();
  if (!text) return;

  const btn = document.getElementById('enrichBtn');
  const out = document.getElementById('enrichOut');
  btn.disabled = true; btn.textContent = '...';
  out.innerHTML = '<span style="color:#bbb;">Loading rules...</span>';

  try {
    const allRules = await loadRules();
    const subjects = detectSubjects(text);
    const rules = filterRules(allRules, subjects);

    out.innerHTML = '<span style="color:#bbb;">Enriching...</span>';

    const res = await fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, rules }),
    });

    const data = await res.json();

    if (data.error) {
      out.innerHTML = `<span style="color:#c0392b;">${data.error}</span>`;
      return;
    }

    renderEnriched(data.enriched_text, data.additions || []);

    const s = document.getElementById('enrichSummary');
    if (s) s.textContent = rules.length
      ? `${rules.length} validated rules applied across ${subjects.length} subject(s).`
      : 'No matching rules found for this text.';

  } catch {
    offlineEnrich(text);
  } finally {
    btn.disabled = false; btn.textContent = 'Enrich →';
  }
}
