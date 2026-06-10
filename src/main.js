import { show, kbTab, useTab, initLangToggle } from './router.js';
import { setActive, initCarousel } from './carousel.js';
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

// Expose functions used by inline HTML handlers
Object.assign(window, { show, kbTab, useTab, setActive, vote, nextT, runEnrich, runGenerate, addTopic, handleFile });

window.addEventListener('load', () => {
  checkApis();
  initCarousel();
  initLangToggle();
});
