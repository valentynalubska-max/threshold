import { show, kbTab, useTab, initLangToggle } from './router.js';
import { selectEntityByQuery } from './explore.js';
import { initGlobalSearch } from './search.js';
import { setActive, initCarousel, closeLightbox } from './carousel.js';
import { initGallery } from './gallery.js';
import { vote, nextT } from './validate.js';
import { runEnrich } from './enrich.js';
import { runGenerate, checkApis } from './generate.js';

function addTopic() {
  const inp = document.getElementById('topicInput');
  const val = inp.value.trim();
  if (!val) return;
  const grid = inp.closest('.topics-col').querySelector('.topics-grid');
  const tag = document.createElement('span');
  tag.className = 'topic-tag sel';
  tag.textContent = val;
  tag.onclick = function () { this.classList.toggle('sel'); };
  grid.appendChild(tag);
  inp.value = '';
  inp.focus();
}

function handleFile(input) {
  if (input.files[0]) {
    const z = input.parentElement;
    z.querySelector('p').textContent = '✓ ' + input.files[0].name;
    z.style.borderColor = 'var(--black)';
    z.style.background = 'var(--light)';
  }
}

function toggleMenu() {
  const menu = document.getElementById('navPages');
  if (menu) menu.classList.toggle('open');
}

function sendToGen() {
  const out = document.getElementById('enrichOut');
  const prompt = document.getElementById('genPrompt');
  const genTabBtn = document.querySelector('.use-tab[onclick*="\'gen\'"]');
  if (!out || !prompt || !genTabBtn) return;
  prompt.value = out.innerText.trim();
  useTab('gen', genTabBtn);
  // Start generation immediately after switching tab
  setTimeout(runGenerate, 60);
}

function _hasEnrichedContent() {
  const out = document.getElementById('enrichOut');
  return out && !out.querySelector('[style*="color:#bbb"]') && out.innerText.trim().length > 0;
}

function copyEnriched() {
  const out = document.getElementById('enrichOut');
  const btn = document.getElementById('copyBtn');
  if (!out || !out.innerText.trim()) return;
  navigator.clipboard.writeText(out.innerText).then(() => {
    if (!btn) return;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}

// Floating tooltip rendered on <body> so scroll containers can't clip it.
// Hover on desktop, tap-to-toggle on touch.
function initTooltips() {
  const tip = document.createElement('div');
  tip.className = 'shell-tip';
  document.body.appendChild(tip);
  let current = null;

  function showTip(term) {
    const text = term.dataset.tip;
    if (!text) return;
    tip.textContent = text;
    tip.style.display = 'block';
    const r = term.getBoundingClientRect();
    let left = r.left;
    if (left + tip.offsetWidth > window.innerWidth - 8) left = window.innerWidth - tip.offsetWidth - 8;
    if (left < 8) left = 8;
    let top = r.top - tip.offsetHeight - 6;
    if (top < 8) top = r.bottom + 6;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.style.display = 'none'; current = null; }

  document.addEventListener('mouseover', e => {
    const term = e.target.closest('.enriched-term');
    if (term) showTip(term);
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('.enriched-term')) hideTip();
  });
  document.addEventListener('click', e => {
    const term = e.target.closest('.enriched-term');
    if (term) {
      if (current === term) { hideTip(); }
      else { showTip(term); current = term; }
    } else {
      hideTip();
    }
  });
  document.addEventListener('scroll', hideTip, true);
}

// Expose functions used by inline HTML handlers
Object.assign(window, { show, kbTab, useTab, setActive, vote, nextT, runEnrich, runGenerate, addTopic, handleFile, copyEnriched, closeLightbox, toggleMenu, sendToGen });

window.addEventListener('load', () => {
  checkApis();
  initCarousel();
  initGallery();
  initLangToggle();
  initTooltips();
  initGlobalSearch(show, selectEntityByQuery);

  // Watch enrichOut for content — show/hide the send button
  const enrichOut = document.getElementById('enrichOut');
  const sendBtn = document.getElementById('sendToGenBtn');
  if (enrichOut && sendBtn) {
    new MutationObserver(() => {
      sendBtn.style.display = _hasEnrichedContent() ? 'block' : 'none';
    }).observe(enrichOut, { childList: true, subtree: true });
  }
});
