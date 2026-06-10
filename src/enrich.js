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
  out.innerHTML = '<span style="color:#bbb;">Enriching...</span>';
  try {
    const res = await fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (data.error) { out.innerHTML = `<span style="color:#c0392b;">${data.error}</span>`; return; }
    let html = escHtml(text);
    const terms = (data.enriched || []).sort((a, b) => b.start - a.start);
    terms.forEach(t => {
      const tip = escAttr(t.annotation + ' [' + t.category + ']');
      html = html.substring(0, t.start) + `<span class="enriched-term" data-tip="${tip}">${escHtml(t.term)}</span>` + html.substring(t.end);
    });
    out.innerHTML = html || '<span style="color:#bbb;">No terms found.</span>';
    const s = document.getElementById('enrichSummary');
    if (s) s.textContent = data.summary || '';
  } catch {
    offlineEnrich(text);
  } finally {
    btn.disabled = false; btn.textContent = 'Enrich →';
  }
}
