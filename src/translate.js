const CYRILLIC = /[а-яА-ЯіІїЇєЄґҐ]/u;
const cache = new Map();

function hasCyrillic(str) {
  return CYRILLIC.test(str);
}

function parseObject(headText) {
  // Format: "SUBJECT — RELATION — OBJECT"
  const parts = headText.split(' — ');
  return parts.length >= 3 ? parts.slice(2).join(' — ').trim() : '';
}

function parseEvidence(quoteText) {
  return quoteText.replace(/^«|»$/g, '').trim();
}

export async function initTranslations(pageId) {
  const page = document.getElementById(pageId);
  if (!page) return;

  const itemEls = [...page.querySelectorAll('.triple-item')];
  if (!itemEls.length) return;

  if (cache.has(pageId)) {
    applyTranslations(itemEls, cache.get(pageId));
    return;
  }

  // Insert loading placeholders
  itemEls.forEach(el => {
    const quote = el.querySelector('.triple-quote');
    if (!quote || el.querySelector('.triple-translation')) return;
    const placeholder = document.createElement('div');
    placeholder.className = 'triple-translation loading';
    placeholder.textContent = '…';
    quote.insertAdjacentElement('afterend', placeholder);
  });

  const items = itemEls.map((el, i) => {
    const head = el.querySelector('.triple-head')?.textContent || '';
    const quote = el.querySelector('.triple-quote')?.textContent || '';
    const obj = parseObject(head);
    return {
      id: String(i),
      evidence: parseEvidence(quote),
      object_uk: hasCyrillic(obj) ? obj : '',
    };
  });

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    cache.set(pageId, data.translations);
    applyTranslations(itemEls, data.translations);
  } catch {
    itemEls.forEach(el => {
      el.querySelector('.triple-translation')?.remove();
    });
  }
}

function applyTranslations(itemEls, translations) {
  translations.forEach(t => {
    const el = itemEls[parseInt(t.id)];
    if (!el) return;

    const quote = el.querySelector('.triple-quote');
    if (!quote) return;

    let div = el.querySelector('.triple-translation');
    if (!div) {
      div = document.createElement('div');
      div.className = 'triple-translation';
      quote.insertAdjacentElement('afterend', div);
    }
    div.classList.remove('loading');
    div.textContent = '';

    if (t.object_en) {
      const objSpan = document.createElement('span');
      objSpan.className = 'trans-obj';
      objSpan.textContent = t.object_en;
      div.appendChild(objSpan);
      const sep = document.createElement('span');
      sep.className = 'trans-sep';
      sep.textContent = ' · ';
      div.appendChild(sep);
    }

    div.appendChild(document.createTextNode(t.evidence_en || ''));
  });
}
