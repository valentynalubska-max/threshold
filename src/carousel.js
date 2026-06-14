export function setActive(el) {
  const track = el.closest('.carousel-track');
  track.querySelectorAll('.carousel-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  centerActive(el);
  openLightbox(el);
}

export function recenter() {
  const page = document.querySelector('.page.active');
  if (!page) return;
  const active = page.querySelector('.carousel-item.active');
  if (active) centerActive(active);
}

function snapToNearest(track) {
  const wrap = track.closest('.carousel-wrap');
  if (!wrap) return;
  const wrapCenter = wrap.getBoundingClientRect().left + wrap.offsetWidth / 2;
  let best = null, bestDist = Infinity;
  track.querySelectorAll('.carousel-item').forEach(item => {
    const r = item.getBoundingClientRect();
    const d = Math.abs(r.left + r.width / 2 - wrapCenter);
    if (d < bestDist) { bestDist = d; best = item; }
  });
  if (!best) return;
  centerActive(best);
}

export function openLightbox(el) {
  const img = el.querySelector('img');
  if (!img) return;
  const box = document.getElementById('lightbox');
  const boxImg = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCap');
  if (!box || !boxImg) return;
  boxImg.src = img.src;
  boxImg.alt = img.alt || '';
  const capEl = el.querySelector('.carousel-cap');
  cap.textContent = (capEl && capEl.textContent) || img.alt || '';
  box.classList.add('show');
}

export function closeLightbox() {
  const box = document.getElementById('lightbox');
  if (box) box.classList.remove('show');
}

export function centerActive(el) {
  const wrap = el.closest('.carousel-wrap');
  const track = el.closest('.carousel-track');
  if (!wrap || !track) return;
  const wW = wrap.offsetWidth;
  const eL = el.offsetLeft;
  const eW = el.offsetWidth;
  track.style.transform = `translateX(${wW / 2 - eL - eW / 2}px)`;
}

export function initCarousel() {
  const activePage = document.querySelector('.page.active');
  const active = activePage ? activePage.querySelector('.carousel-item.active') : null;
  if (active) centerActive(active);

  document.querySelectorAll('.carousel-track').forEach(track => {
    let down = false, startX = 0, baseX = 0, moved = false;
    track.addEventListener('pointerdown', e => {
      down = true;
      moved = false;
      startX = e.pageX;
      const m = new DOMMatrix(getComputedStyle(track).transform);
      baseX = m.m41 || 0;
      track.style.transition = 'none';
    });
    document.addEventListener('pointermove', e => {
      if (!down) return;
      if (Math.abs(e.pageX - startX) > 5) moved = true;
      track.style.transform = `translateX(${baseX + e.pageX - startX}px)`;
    });
    document.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      track.style.transition = '';
      if (moved) snapToNearest(track);
    });
    track.addEventListener('click', e => {
      if (moved) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
  window.addEventListener('resize', recenter);
}
