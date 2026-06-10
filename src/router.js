import { renderVal } from './validate.js';

const pages = { home:'p-home', pich:'p-pich', add:'p-add', validate:'p-validate', use:'p-use', about:'p-about' };

export function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(pages[id] || id);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(n => n.classList.toggle('active', n.dataset.page === id));
  const menu = document.getElementById('navPages');
  if (menu) menu.classList.remove('open');
  window.scrollTo(0, 0);
  if (id === 'validate') renderVal();
}

export function kbTab(name, btn) {
  document.querySelectorAll('.kb-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
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
      document.querySelectorAll('.lang-toggle span').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
    });
  });
}
