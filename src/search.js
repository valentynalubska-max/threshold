// Global nav search — page shortcuts + knowledge-graph entity lookup

let _lexicon     = null;
let _lexLoading  = false;

const PAGE_SHORTCUTS = [
  { id: 'explore',  keywords: ['explore','graph','knowledge','граф','дослідити','вузли'],           en: 'Explore',   uk: 'Дослідити' },
  { id: 'use',      keywords: ['generate','use','enrich','image','генерація','збагатити','текст'],   en: 'Generate',  uk: 'Генерація' },
  { id: 'add',      keywords: ['teach','add','upload','pdf','навчання','додати'],                    en: 'Teach',     uk: 'Навчання' },
  { id: 'validate', keywords: ['validate','review','tag','валідація','перевірка'],                   en: 'Validate',  uk: 'Валідація' },
  { id: 'about',    keywords: ['about','info','project','про','проект'],                             en: 'About',     uk: 'Про проект' },
  { id: 'home',     keywords: ['home','start','головна','початок'],                                  en: 'Home',      uk: 'Головна' },
  { id: 'pich',     keywords: ['pich','піч','stove','oven'],                                         en: 'Pich',      uk: 'Піч' },
  { id: 'khata',    keywords: ['khata','хата','house'],                                              en: 'Khata',     uk: 'Хата' },
  { id: 'pokut',    keywords: ['pokut','покуть','corner','sacred'],                                  en: 'Pokut',     uk: 'Покуть' },
  { id: 'ornament', keywords: ['ornament','розпис','painting','decoration'],                         en: 'Ornament',  uk: 'Розпис' },
  { id: 'porig',    keywords: ['porig','поріг','threshold'],                                         en: 'Porig',     uk: 'Поріг' },
  { id: 'vikno',    keywords: ['vikno','вікно','window'],                                            en: 'Vikno',     uk: 'Вікно' },
];

async function _loadLexicon() {
  if (_lexicon || _lexLoading) return;
  _lexLoading = true;
  try {
    const data = await fetch('/data/entities_lexicon.json').then(r => r.json());
    _lexicon = Object.entries(data)
      .filter(([k]) => k !== '_meta')
      .map(([id, v]) => ({
        id,
        label_uk: v.label_uk || id,
        label_en: v.label_en || id,
        type: (v.type || 'unknown').toLowerCase(),
        aliases: v.aliases || [],
      }));
  } catch { _lexLoading = false; }
}

function _matchPages(q) {
  return PAGE_SHORTCUTS.filter(p =>
    p.en.toLowerCase().includes(q) ||
    p.uk.toLowerCase().includes(q) ||
    p.keywords.some(kw => kw.includes(q))
  ).slice(0, 4);
}

function _matchEntities(q) {
  if (!_lexicon) return [];
  return _lexicon.filter(n =>
    n.label_uk.toLowerCase().includes(q) ||
    n.label_en.toLowerCase().includes(q) ||
    n.id.toLowerCase().includes(q) ||
    n.aliases.some(a => a.toLowerCase().includes(q))
  ).slice(0, 6);
}

export function initGlobalSearch(showFn, selectEntityFn) {
  const input = document.querySelector('.nav-search input');
  const wrap  = document.querySelector('.nav-search');
  if (!input || !wrap) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'gsearch-dropdown';
  wrap.appendChild(dropdown);

  let _items  = [];
  let _cursor = -1;

  function _close() {
    dropdown.innerHTML = '';
    dropdown.classList.remove('open');
    _items  = [];
    _cursor = -1;
  }

  function _setCursor(i) {
    dropdown.querySelectorAll('.gsearch-item').forEach((el, idx) =>
      el.classList.toggle('active', idx === i)
    );
    _cursor = i;
  }

  function _navigate(item) {
    _close();
    input.value = '';
    if (item.kind === 'page') {
      showFn(item.id);
    } else {
      showFn('explore');
      // Allow initExplore() to run; if data already cached _ready=true and it fires instantly
      setTimeout(() => selectEntityFn(item.query), 80);
    }
  }

  function _render(q) {
    const pages    = _matchPages(q);
    const entities = _matchEntities(q);

    _items = [
      ...pages.map(p => ({ kind: 'page', id: p.id, label: p.en, sub: p.uk + ' · page' })),
      ...entities.map(e => ({ kind: 'entity', query: e.label_uk, label: e.label_uk, sub: e.label_en + ' · ' + e.type })),
    ];

    if (!_items.length) { _close(); return; }

    dropdown.innerHTML = _items.map((item, i) => `
      <div class="gsearch-item" data-i="${i}">
        <span class="gsearch-label">${item.label}</span>
        <span class="gsearch-sub">${item.sub}</span>
      </div>
    `).join('');
    dropdown.classList.add('open');

    dropdown.querySelectorAll('.gsearch-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent blur before click
        _navigate(_items[+el.dataset.i]);
      });
    });
    _cursor = -1;
  }

  input.addEventListener('input', async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { _close(); return; }
    if (!_lexicon) _loadLexicon().then(() => { if (input.value.trim()) _render(input.value.trim().toLowerCase()); });
    _render(q);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { _close(); input.blur(); return; }
    if (!_items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); _setCursor((_cursor + 1) % _items.length); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _setCursor((_cursor - 1 + _items.length) % _items.length); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      _navigate(_cursor >= 0 ? _items[_cursor] : _items[0]);
    }
  });

  input.addEventListener('focus', () => {
    const q = input.value.trim().toLowerCase();
    if (q) _render(q);
  });

  input.addEventListener('blur', () => setTimeout(_close, 160));

  // Pre-load lexicon silently so first search is instant
  setTimeout(_loadLexicon, 600);
}
