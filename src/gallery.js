// Fixed-height horizontal gallery: small thumbnails on load,
// click to expand in place (grows upward), arrows to navigate,
// click same image or outside to collapse. Section height never changes.

const EASE = 'transform 0.32s ease';

// ── Public API ────────────────────────────────────────────────────────────────

export function initGallery() {
  document.querySelectorAll('.gallery').forEach(_setup);

  // Collapse when clicking anywhere outside a gallery
  document.addEventListener('click', e => {
    if (!e.target.closest('.gallery')) {
      document.querySelectorAll('.gallery-item.active')
        .forEach(el => _collapse(el.closest('.gallery')));
    }
  });
}

// Called from router.js when navigating to a subject page
export function galleryRecenter() {
  const page = document.querySelector('.page.active');
  if (!page) return;
  const active = page.querySelector('.gallery-item.active');
  if (active) _centerOn(active.closest('.gallery'), active, false);
}

// ── Per-gallery setup ─────────────────────────────────────────────────────────

function _setup(gallery) {
  const track = gallery.querySelector('.gallery-track');
  if (!track) return;

  // Delegate clicks on items (no inline onclick needed)
  track.addEventListener('click', e => {
    if (gallery._drag) return;
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    item.classList.contains('active') ? _collapse(gallery) : _expand(gallery, item);
  });

  // Arrow buttons
  gallery.querySelector('.gal-prev')
    ?.addEventListener('click', e => { e.stopPropagation(); _navigate(gallery, -1); });
  gallery.querySelector('.gal-next')
    ?.addEventListener('click', e => { e.stopPropagation(); _navigate(gallery, +1); });

  _setupDrag(gallery, track);
}

// ── State changes ─────────────────────────────────────────────────────────────

function _expand(gallery, item) {
  gallery.querySelectorAll('.gallery-item').forEach(i => i.classList.remove('active'));
  item.classList.add('active');
  gallery.querySelectorAll('.gallery-arrow').forEach(a => a.classList.add('visible'));
  _centerOn(gallery, item, true);
}

function _collapse(gallery) {
  gallery.querySelectorAll('.gallery-item').forEach(i => i.classList.remove('active'));
  gallery.querySelectorAll('.gallery-arrow').forEach(a => a.classList.remove('visible'));
}

function _navigate(gallery, dir) {
  const items = Array.from(gallery.querySelectorAll('.gallery-item'));
  const cur = items.findIndex(i => i.classList.contains('active'));
  if (cur < 0) return;
  const next = items[cur + dir];
  if (next) _expand(gallery, next);
}

// ── Centering ─────────────────────────────────────────────────────────────────

// Uses getBoundingClientRect so the current translateX is already factored in.
// shift = how far to move the track so item.center aligns with gallery.center
function _centerOn(gallery, item, animate) {
  const track = gallery.querySelector('.gallery-track');
  if (!track || !gallery.offsetWidth) return;
  const gr = gallery.getBoundingClientRect();
  const ir = item.getBoundingClientRect();
  const curTx = new DOMMatrix(getComputedStyle(track).transform).m41 || 0;
  const shift = (gr.left + gr.width / 2) - (ir.left + ir.width / 2);
  track.style.transition = animate ? EASE : 'none';
  track.style.transform = `translateX(${curTx + shift}px)`;
}

// ── Drag / swipe ──────────────────────────────────────────────────────────────

function _setupDrag(gallery, track) {
  let dn = false, sx = 0, stx = 0, vx = 0, lx = 0, lt = 0;

  const getTx = () => new DOMMatrix(getComputedStyle(track).transform).m41 || 0;

  track.addEventListener('pointerdown', e => {
    dn = true; gallery._drag = false;
    sx = lx = e.pageX;
    stx = getTx();
    vx = 0; lt = Date.now();
    track.style.transition = 'none';
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener('pointermove', e => {
    if (!dn) return;
    if (Math.abs(e.pageX - sx) > 5) gallery._drag = true;
    if (!gallery._drag) return;
    const now = Date.now(), dt = now - lt;
    if (dt > 0) vx = (e.pageX - lx) / dt;
    lx = e.pageX; lt = now;
    track.style.transform = `translateX(${stx + (e.pageX - sx)}px)`;
  });

  track.addEventListener('pointerup', e => {
    if (!dn) return;
    dn = false;
    track.releasePointerCapture(e.pointerId);
    if (gallery._drag) {
      // Coast with momentum then stop
      track.style.transition = EASE;
      track.style.transform = `translateX(${getTx() + vx * 180}px)`;
    }
    // Clear after click event has already fired (synchronous event order)
    setTimeout(() => { gallery._drag = false; }, 20);
  });
}
