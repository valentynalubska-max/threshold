// Item dimensions (must match CSS)
const W_SM = 90, W_LG = 200;
const H_SM = 120, H_LG = 280;
const GAP = 12;
const CLONE = 5; // items cloned at each end for infinite loop
const EASE = 'transform .42s cubic-bezier(0.4,0,0.2,1)';
const LOOP_DELAY = 450; // ms — wait for transition before silent jump

const itemW = el => el.classList.contains('active') ? W_LG : W_SM;

// ── Lightbox ──────────────────────────────────────────────────────────────────

export function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('show');
}

function openLightbox(el) {
  const img = el.querySelector('img');
  const box = document.getElementById('lightbox');
  const boxImg = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCap');
  if (!box || !boxImg || !img) return;
  boxImg.src = img.src;
  boxImg.alt = img.alt || '';
  cap.textContent = el.querySelector('.carousel-cap')?.textContent || img.alt || '';
  box.classList.add('show');
}

// ── Public API (called from HTML onclick) ─────────────────────────────────────

export function setActive(el) {
  el.closest('.carousel-track')?._cs?.activate(el);
}

export function recenter() {
  document.querySelector('.page.active')
    ?.querySelectorAll('.carousel-wrap')
    .forEach(w => w._cs?.recenter());
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initCarousel() {
  document.querySelectorAll('.carousel-wrap').forEach(_setup);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
  window.addEventListener('resize', recenter);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _getTx(track) {
  return new DOMMatrix(getComputedStyle(track).transform).m41 || 0;
}

// Compute translateX so `target` is centered in the wrap
function _computeTx(items, target, wrapW) {
  let left = 0;
  for (const it of items) {
    if (it === target) break;
    left += itemW(it) + GAP;
  }
  return wrapW / 2 - left - itemW(target) / 2;
}

// ── Per-track setup ───────────────────────────────────────────────────────────

function _setup(wrap) {
  const track = wrap.querySelector('.carousel-track');
  if (!track) return;

  const orig = Array.from(track.children);
  const n = orig.length;
  if (!n) return;

  const cn = Math.min(CLONE, n);

  // Prepend clones of the last cn items (reversed so strip order is maintained)
  for (let i = n - 1; i >= n - cn; i--) {
    const c = orig[i].cloneNode(true);
    c.classList.remove('active');
    track.prepend(c);
  }
  // Append clones of the first cn items
  for (let i = 0; i < cn; i++) {
    const c = orig[i].cloneNode(true);
    c.classList.remove('active');
    track.append(c);
  }

  const kids = () => Array.from(track.children);

  // Real items occupy indices cn … cn+n-1
  const realEnd = cn + n - 1;

  // Active index among original items
  const origActiveIdx = orig.findIndex(el => el.classList.contains('active'));
  let cur = cn + (origActiveIdx >= 0 ? origActiveIdx : 0);

  // Sync DOM — only cur should have active
  kids().forEach((it, i) => it.classList.toggle('active', i === cur));

  // ── Move / activate ───────────────────────────────────────────────────────

  function moveTo(idx, animate) {
    const all = kids();
    track.style.transition = animate ? EASE : 'none';
    if (all[idx]) {
      track.style.transform =
        `translateX(${_computeTx(all, all[idx], wrap.offsetWidth)}px)`;
    }
  }

  function activateIdx(idx, animate = true) {
    const all = kids();
    if (idx < 0 || idx >= all.length) return;

    all.forEach((it, i) => it.classList.toggle('active', i === idx));
    moveTo(idx, animate);
    cur = idx;

    // Infinite-loop: silently jump to real counterpart after transition
    if (idx < cn) {
      // Prepended clone at position idx is a copy of orig[n-1-idx]
      // Its real counterpart is at realEnd - idx
      const jump = realEnd - idx;
      setTimeout(() => {
        const k = kids();
        k.forEach((it, i) => it.classList.toggle('active', i === jump));
        cur = jump;
        moveTo(jump, false);
      }, LOOP_DELAY);
    } else if (idx > realEnd) {
      // Appended clone at position idx is a copy of orig[idx - cn - n]
      // Its real counterpart is at cn + (idx - cn - n) = idx - n
      const jump = idx - n;
      setTimeout(() => {
        const k = kids();
        k.forEach((it, i) => it.classList.toggle('active', i === jump));
        cur = jump;
        moveTo(jump, false);
      }, LOOP_DELAY);
    }
  }

  // Initial placement — no animation
  requestAnimationFrame(() => moveTo(cur, false));

  // Expose API on both track and wrap
  const cs = {
    activate(el) {
      const all = kids();
      const idx = all.indexOf(el);
      if (idx < 0) return;
      if (idx === cur) { openLightbox(el); return; } // second tap → lightbox
      activateIdx(idx);
    },
    recenter() { moveTo(cur, false); },
  };
  track._cs = cs;
  wrap._cs = cs;

  // ── Drag / swipe ──────────────────────────────────────────────────────────

  let dn = false, sx = 0, stx = 0, vx = 0, lx = 0, lt = 0;

  track.addEventListener('pointerdown', e => {
    dn = true;
    track._drag = false;
    sx = lx = e.pageX;
    stx = _getTx(track);
    vx = 0; lt = Date.now();
    track.style.transition = 'none';
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener('pointermove', e => {
    if (!dn) return;
    if (Math.abs(e.pageX - sx) > 5) track._drag = true;
    if (!track._drag) return;
    const now = Date.now(), dt = now - lt;
    if (dt > 0) vx = (e.pageX - lx) / dt;
    lx = e.pageX; lt = now;
    track.style.transform = `translateX(${stx + (e.pageX - sx)}px)`;
  });

  track.addEventListener('pointerup', e => {
    if (!dn) return;
    dn = false;
    track.releasePointerCapture(e.pointerId);
    if (!track._drag) return;

    // Apply momentum then snap to nearest item
    const finalTx = _getTx(track) + vx * 200;
    const all = kids();
    const wW = wrap.offsetWidth;
    let best = cur, bestD = Infinity, left = 0;
    for (let i = 0; i < all.length; i++) {
      const w = itemW(all[i]);
      const d = Math.abs(wW / 2 - left - w / 2 - finalTx);
      if (d < bestD) { bestD = d; best = i; }
      left += w + GAP;
    }
    activateIdx(best);

    // Clear flag after click event has fired so inline onclick is blocked
    setTimeout(() => { track._drag = false; }, 20);
  });

  // Swallow click events that follow a drag
  track.addEventListener('click', e => {
    if (track._drag) e.stopPropagation();
  }, true);
}
