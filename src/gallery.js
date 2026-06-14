// Fixed-height horizontal gallery.
// Thumbnails at rest, click to expand to natural aspect ratio in place.
// Drag the strip with mouse or finger.

const EASE = 'transform 0.32s ease';
const W_MAX = 480;      // max expanded width (landscape cap)

// Match CSS breakpoints so expanded-height calculation stays in sync with CSS
const MQ_MOBILE = window.matchMedia('(max-width: 600px)');
function _expandedH() { return MQ_MOBILE.matches ? 260 : 360; }
function _collapsedW() { return MQ_MOBILE.matches ? 100 : 140; }

// ── Public API ────────────────────────────────────────────────────────────────

export function initGallery() {
  document.querySelectorAll('.gallery').forEach(_setup);

  // Clicking anywhere outside a gallery collapses it
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
  if (active) {
    const w = parseFloat(active.style.width) || _collapsedW();
    _centerTo(active.closest('.gallery'), active, w, false);
  }
}

// ── Per-gallery setup ─────────────────────────────────────────────────────────

function _setup(gallery) {
  const track = gallery.querySelector('.gallery-track');
  if (!track) return;

  // Direct click listeners — avoids all pointer-capture ambiguity
  gallery.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      if (gallery._dragged) return;   // swallow click after a drag
      if (item.classList.contains('active')) {
        _collapse(gallery);
      } else {
        _expand(gallery, item);
      }
    });
  });

  gallery.querySelector('.gal-prev')
    ?.addEventListener('click', e => { e.stopPropagation(); _navigate(gallery, -1); });
  gallery.querySelector('.gal-next')
    ?.addEventListener('click', e => { e.stopPropagation(); _navigate(gallery, +1); });

  _setupDrag(gallery, track);
}

// ── State ─────────────────────────────────────────────────────────────────────

function _expand(gallery, item) {
  // Reset all items
  gallery.querySelectorAll('.gallery-item').forEach(i => {
    i.classList.remove('active');
    i.style.width = '';
  });
  item.classList.add('active');
  gallery.querySelectorAll('.gallery-arrow').forEach(a => a.classList.add('visible'));

  // Compute natural-ratio target width, then center
  const img = item.querySelector('img');
  const go = () => {
    const hLg = _expandedH();
    const nat = (img && img.naturalWidth && img.naturalHeight)
      ? Math.min(W_MAX, Math.round(hLg * img.naturalWidth / img.naturalHeight))
      : _collapsedW();
    item.style.width = nat + 'px';
    _centerTo(gallery, item, nat, true);
  };

  if (img && img.complete && img.naturalWidth) {
    go();
  } else if (img) {
    img.addEventListener('load', go, { once: true });
  }
}

function _collapse(gallery) {
  gallery.querySelectorAll('.gallery-item').forEach(i => {
    i.classList.remove('active');
    i.style.width = '';
  });
  gallery.querySelectorAll('.gallery-arrow').forEach(a => a.classList.remove('visible'));
}

function _navigate(gallery, dir) {
  const items = Array.from(gallery.querySelectorAll('.gallery-item'));
  const cur = items.findIndex(i => i.classList.contains('active'));
  const next = items[cur + dir];
  if (next) _expand(gallery, next);
}

// ── Centering ─────────────────────────────────────────────────────────────────

// Computes translateX so the item (at its FINAL targetW) is centred in the gallery.
// Uses the item's un-transformed natural left so the answer is always accurate
// regardless of what state the CSS transition is in.
function _centerTo(gallery, item, targetW, animate) {
  const track = gallery.querySelector('.gallery-track');
  if (!track) return;
  const galW = gallery.getBoundingClientRect().width;
  if (!galW) return;

  const ir = item.getBoundingClientRect();
  const curTx = new DOMMatrix(getComputedStyle(track).transform).m41 || 0;

  // Natural (un-transformed) left edge of the item
  const naturalLeft = ir.left - curTx;
  const newTx = galW / 2 - naturalLeft - targetW / 2;

  track.style.transition = animate ? EASE : 'none';
  track.style.transform = `translateX(${newTx}px)`;
}

// ── Drag / swipe ──────────────────────────────────────────────────────────────

function _setupDrag(gallery, track) {
  const getTx = () => new DOMMatrix(getComputedStyle(track).transform).m41 || 0;

  track.addEventListener('pointerdown', e => {
    // Only primary button / touch
    if (e.button > 0) return;

    let dragged = false;
    const sx = e.clientX;
    const stx = getTx();
    let vx = 0, lx = e.clientX, lt = Date.now();

    gallery._dragged = false;
    track.style.transition = 'none';

    // Use document listeners so drag works even if pointer leaves the track
    const onMove = e => {
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 5) dragged = true;
      if (!dragged) return;
      const now = Date.now(), dt = now - lt;
      if (dt > 0) vx = (e.clientX - lx) / dt;
      lx = e.clientX; lt = now;
      track.style.transform = `translateX(${stx + dx}px)`;
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      if (dragged) {
        track.style.transition = EASE;
        track.style.transform = `translateX(${getTx() + vx * 180}px)`;
        gallery._dragged = true;
        // Clear flag AFTER click event fires (click is synchronous after pointerup)
        setTimeout(() => { gallery._dragged = false; }, 50);
      } else {
        // Non-drag tap: restore transition so subsequent expand animates correctly
        track.style.transition = '';
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}
