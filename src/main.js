import { show, kbTab, useTab, initLangToggle } from './router.js';
import { setActive, initCarousel, closeLightbox } from './carousel.js';
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

// Tap-to-toggle tooltips on enriched terms (mobile has no hover)
function initTapTooltips() {
  const out = document.getElementById('enrichOut');
  if (!out) return;
  out.addEventListener('click', e => {
    const term = e.target.closest('.enriched-term');
    document.querySelectorAll('.enriched-term.tip-open').forEach(t => {
      if (t !== term) t.classList.remove('tip-open');
    });
    if (term) term.classList.toggle('tip-open');
  });
}

// Expose functions used by inline HTML handlers
Object.assign(window, { show, kbTab, useTab, setActive, vote, nextT, runEnrich, runGenerate, addTopic, handleFile, copyEnriched, closeLightbox, toggleMenu });

window.addEventListener('load', () => {
  checkApis();
  initCarousel();
  initLangToggle();
  initTapTooltips();
});
