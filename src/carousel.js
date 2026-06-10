export function setActive(el) {
  if (el.classList.contains('active')) { openLightbox(el); return; }
  const track = document.getElementById('cTrack');
  Array.from(track.querySelectorAll('.carousel-item')).forEach(item => {
    item.classList.remove('active');
    item.style.width = item.dataset.w + 'px';
    item.style.height = item.dataset.h + 'px';
  });
  el.classList.add('active');
  el.style.width = '270px';
  el.style.height = '360px';
  centerActive(el);
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
  const capEl = el.querySelector('.cap');
  cap.textContent = (capEl && capEl.textContent) || img.alt || '';
  box.classList.add('show');
}

export function closeLightbox() {
  const box = document.getElementById('lightbox');
  if (box) box.classList.remove('show');
}

export function centerActive(el) {
  const wrap = document.getElementById('cWrap');
  const track = document.getElementById('cTrack');
  const wW = wrap.offsetWidth;
  const eL = el.offsetLeft;
  const eW = parseInt(el.style.width) || 270;
  track.style.transform = `translateX(${wW / 2 - eL - eW / 2}px)`;
}

export function initCarousel() {
  const items = document.querySelectorAll('.carousel-item');
  items.forEach(it => {
    it.style.width = it.dataset.w + 'px';
    it.style.height = it.dataset.h + 'px';
  });
  const active = document.querySelector('.carousel-item.active');
  if (active) centerActive(active);

  const track = document.getElementById('cTrack');
  if (!track) return;
  let down = false, startX = 0, baseX = 0, moved = false;
  track.addEventListener('pointerdown', e => {
    down = true;
    moved = false;
    startX = e.pageX;
    const m = new DOMMatrix(getComputedStyle(track).transform);
    baseX = m.m41 || 0;
  });
  document.addEventListener('pointermove', e => {
    if (!down) return;
    if (Math.abs(e.pageX - startX) > 5) moved = true;
    track.style.transform = `translateX(${baseX + e.pageX - startX}px)`;
  });
  document.addEventListener('pointerup', () => down = false);
  track.addEventListener('click', e => {
    if (moved) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });
}
