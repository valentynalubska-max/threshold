let triples = [];
let cur = 0;

const fallback = [
  { src:'B4 Masnenko 2012 · p.31', tr:'СВОЛОК — LOCATED_ON_AXIS_WITH — покуть та піч', ev:'«Сволок пролягає між піччю та покутем, утворюючи головну просторову вісь хати від сакрального кута до ритуального вогнища.»' },
  { src:'B4 Masnenko 2012 · p.32', tr:'ПІЧ — MADE_OF — глина та цегла', ev:'«Піч виліплена з глини, обмащена й побілена крейдою.»' },
  { src:'REV438 · B4 Masnenko 2012 · p.5', tr:'ДОЛІВКА — IS_PROTECTIVE_AGAINST — нечистих сил', ev:'«Вище долівки – для охорони від нечистих сил.»' },
  { src:'REV343 · B4 Masnenko 2012 · p.4', tr:'СВОЛОК — IS_COSMOLOGICALLY_IDENTIFIED_AS — небесна ясная зоря', ev:'«Чумацький Шлях, а покуть – небесна ясная зоря.»' },
  { src:'REV187 · vector_rag', tr:'TABLE — IS_PROTECTIVE_AGAINST — вигнання з хати', ev:'«Не можна виносити з хати стола, не покритого скатертиною, голого, бо в господі того, кому переноситься стіл, стане голо.»' },
  { src:'REV186 · vector_rag', tr:'ПІЧ — IS_ASSOCIATED_WITH — центр житла', ev:'«Піч (раніше відкрите вогнище) була центром житла. Вся інша площа – своєрідною добудовою до неї.»' },
  { src:'REV284 · B4 Masnenko 2012 · p.17', tr:'ПІЧ — MADE_OF — складені з глиняних вальків', ev:'«(Волинь, Полісся) печі мали інший конструктивний матеріал: складені з глиняних вальків.»' },
];

export async function loadTriples() {
  try {
    const res = await fetch('/data/rules.json');
    const all = await res.json();
    const pending = all.filter(r => r.status === 'KEPT' && !r.human_tag);
    triples = (pending.length ? pending : all.filter(r => r.status === 'KEPT').slice(0, 20))
      .map(r => ({
        src: (r.source_ref || '').replace(/_/g, ' ') + (r.pipeline ? ' · ' + r.pipeline : ''),
        tr: `${r.subject} — ${r.relation} — ${r.object}`,
        ev: `«${r.evidence}»`,
      }));
  } catch {
    triples = fallback;
  }
  cur = 0;
}

export function renderVal() {
  if (!triples.length) { loadTriples().then(() => renderVal()); return; }
  const t = triples[cur];
  document.getElementById('valBody').innerHTML = `
    <div class="src-ref">${t.src}</div>
    <div class="triple-card"><div class="triple-pill">${t.tr}</div></div>
    <div class="triple-evidence">${t.ev}</div>
    <div class="val-btns">
      <button class="val-btn t" onclick="vote('t')">TRUE</button>
      <button class="val-btn f" onclick="vote('f')">FALSE</button>
      <button class="val-btn c" onclick="vote('c')">CONTESTED</button>
    </div>
    <button id="nBtn" class="val-next" onclick="nextT()">Next →</button>
    <div class="val-counter">${cur + 1} / ${triples.length}</div>
  `;
}

export function vote(v) {
  document.querySelectorAll('.val-btn').forEach(b => b.className = 'val-btn ' + b.classList[1]);
  document.querySelector('.val-btn.' + v).classList.add('s' + v);
  document.getElementById('nBtn').classList.add('show');
}

export function nextT() { cur = (cur + 1) % triples.length; renderVal(); }
