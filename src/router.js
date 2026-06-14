import { renderVal } from './validate.js';
import { galleryRecenter } from './gallery.js';
import { initTranslations } from './translate.js';

const pages = { home:'p-home', pich:'p-pich', khata:'p-khata', pokut:'p-pokut', ornament:'p-ornament', porig:'p-porig', vikno:'p-vikno', add:'p-add', validate:'p-validate', use:'p-use', about:'p-about' };

export function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(pages[id] || id);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.page === id));
  const menu = document.getElementById('navPages');
  if (menu) menu.classList.remove('open');
  window.scrollTo(0, 0);
  if (id === 'validate') renderVal();
  if (id === 'pich') { galleryRecenter(); initTranslations('p-pich'); }
  if (id === 'khata') { galleryRecenter(); initTranslations('p-khata'); }
  if (id === 'pokut') { galleryRecenter(); initTranslations('p-pokut'); }
  if (id === 'ornament') { galleryRecenter(); initTranslations('p-ornament'); }
  if (id === 'porig') { galleryRecenter(); initTranslations('p-porig'); }
  if (id === 'vikno') { galleryRecenter(); initTranslations('p-vikno'); }
}

export function kbTab(name, btn) {
  const page = btn.closest('.page');
  page.querySelectorAll('.kb-tab').forEach(t => t.classList.remove('active'));
  page.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('t-' + name).classList.add('active');
}

export function useTab(name, btn) {
  document.querySelectorAll('.use-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.use-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('u-' + name).classList.add('active');
}

export function initLangToggle() {
  document.querySelectorAll('.lang-toggle span').forEach(s => {
    s.addEventListener('click', () => {
      const isUk = s.textContent.trim() === 'UA';
      document.querySelectorAll('.lang-toggle span').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      document.body.classList.toggle('lang-uk', isUk);

      const ph = isUk ? {
        search: 'Пошук в архіві...',
        enrichIn: 'Вставте будь-який текст про народне будівництво...',
        genPrompt: "Опишіть сцену — напр. 'Інтер’єр хати з побіленими стінами і розписаною піччю, природне освітлення'",
        topicInput: 'Нова тема...',
      } : {
        search: 'Search archive...',
        enrichIn: 'paste any Ukrainian text on vernacular architecture...',
        genPrompt: "Describe the scene — e.g. 'Ukrainian khata interior with whitewashed walls and decorated pich, natural light, ethnographic photograph style'",
        topicInput: 'New topic...',
      };

      const searchEl = document.querySelector('.nav-search input');
      if (searchEl) searchEl.placeholder = ph.search;
      const enrichEl = document.getElementById('enrichIn');
      if (enrichEl) enrichEl.placeholder = ph.enrichIn;
      const genEl = document.getElementById('genPrompt');
      if (genEl) genEl.placeholder = ph.genPrompt;
      const topicEl = document.getElementById('topicInput');
      if (topicEl) topicEl.placeholder = ph.topicInput;

      if (document.getElementById('p-validate')?.classList.contains('active')) renderVal();
    });
  });
}
