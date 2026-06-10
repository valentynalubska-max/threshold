export function setActive(el) {
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
  let down = false, startX = 0, baseX = 0;
  track.addEventListener('mousedown', e => {
    down = true;
    startX = e.pageX;
    const m = new DOMMatrix(getComputedStyle(track).transform);
    baseX = m.m41 || 0;
  });
  document.addEventListener('mousemove', e => {
    if (!down) return;
    track.style.transform = `translateX(${baseX + e.pageX - startX}px)`;
  });
  document.addEventListener('mouseup', () => down = false);
}
