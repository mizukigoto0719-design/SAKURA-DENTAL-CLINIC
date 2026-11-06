(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 1. Hamburger menu ===== */
  const hamburger = $('#hamburger');
  const gnav = $('#gnav');
  const overlay = $('#navOverlay');

  function toggleNav(open) {
    const isOpen = open ?? hamburger.getAttribute('aria-expanded') !== 'true';
    hamburger.setAttribute('aria-expanded', isOpen);
    hamburger.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    gnav.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('is-locked', isOpen);
  }
  hamburger.addEventListener('click', () => toggleNav());
  overlay.addEventListener('click', () => toggleNav(false));
  $$('a, button', gnav).forEach(el => el.addEventListener('click', () => toggleNav(false)));
  window.matchMedia('(min-width: 961px)').addEventListener('change', e => e.matches && toggleNav(false));

  /* ===== 2. Swipe slider ===== */
  (function slider() {
    const root = $('#slider');
    if (!root) return; // スライダーがないページ（ippan.htmlなど）ではスキップ
    const viewport = $('.slider__viewport', root);
    const track = $('.slider__track', root);
    const slides = $$('.slide', track);
    const dotsWrap = $('.slider__dots', root);
    const total = slides.length;
    let index = 0, startX = 0, dx = 0, dragging = false, timer = null, width = 0;

    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slider__dot';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `スライド${i + 1}`);
      b.addEventListener('click', () => { go(i); restart(); });
      dotsWrap.appendChild(b);
      return b;
    });

    function go(i) {
      index = (i + total) % total;
      track.style.transform = `translateX(${-index * 100}%)`;
      dots.forEach((d, n) => {
        d.classList.toggle('is-active', n === index);
        d.setAttribute('aria-selected', n === index);
      });
      slides.forEach((s, n) => s.setAttribute('aria-hidden', n !== index));
    }

    function start() { if (!reduceMotion) timer = setInterval(() => go(index + 1), 5500); }
    function stop() { clearInterval(timer); }
    function restart() { stop(); start(); }

    // Pointer events: mouse drag + touch swipe
    viewport.addEventListener('pointerdown', e => {
      if (e.target.closest('a, button')) return;
      dragging = true; startX = e.clientX; dx = 0; width = viewport.offsetWidth;
      track.classList.add('is-dragging');
      viewport.setPointerCapture(e.pointerId);
      stop();
    });
    viewport.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const pct = (dx / width) * 100;
      track.style.transform = `translateX(${-index * 100 + pct}%)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      if (Math.abs(dx) > width * 0.15) go(index + (dx < 0 ? 1 : -1));
      else go(index);
      start();
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);
    viewport.addEventListener('dragstart', e => e.preventDefault());

    $('.slider__arrow--prev', root).addEventListener('click', () => { go(index - 1); restart(); });
    $('.slider__arrow--next', root).addEventListener('click', () => { go(index + 1); restart(); });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', () => { if (!dragging) restart(); });
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { go(index - 1); restart(); }
      if (e.key === 'ArrowRight') { go(index + 1); restart(); }
    });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : restart());

    go(0); start();
  })();

  /* ===== 3. Parallax ===== */
  (function parallax() {
    if (reduceMotion) return;
    const items = $$('[data-parallax]');
    let ticking = false;
    function update() {
      const vh = window.innerHeight;
      items.forEach(el => {
        const box = el.parentElement.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        const speed = parseFloat(el.dataset.parallax) || 0.15;
        const offset = (box.top + box.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  })();

  /* ===== 4. Accordion ===== */
  (function accordion() {
    const items = $$('.accordion__item');
    items.forEach(item => {
      const btn = $('.accordion__btn', item);
      const panel = $('.accordion__panel', item);
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        // 他を閉じる（複数開きたい場合はこのforEachを削除）
        items.forEach(o => o !== item && close(o));
        open ? close(item) : openItem(item);
      });
    });
    function openItem(item) {
      const panel = $('.accordion__panel', item);
      $('.accordion__btn', item).setAttribute('aria-expanded', 'true');
      item.classList.add('is-open');
      panel.style.height = panel.scrollHeight + 'px';
    }
    function close(item) {
      const panel = $('.accordion__panel', item);
      $('.accordion__btn', item).setAttribute('aria-expanded', 'false');
      item.classList.remove('is-open');
      panel.style.height = '0px';
    }
    window.addEventListener('resize', () => {
      $$('.accordion__item.is-open').forEach(i => {
        const p = $('.accordion__panel', i); p.style.height = p.scrollHeight + 'px';
      });
    });
  })();

  /* ===== 5. Modal ===== */
  (function modal() {
    let active = null, lastFocus = null;
    const focusable = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

    function open(name) {
      const m = $(`#modal-${name}`);
      if (!m) return;
      if (active && active !== m) close(true);
      lastFocus = document.activeElement;
      active = m;
      m.classList.add('is-open');
      m.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
      setTimeout(() => ($('input, button', $('.modal__dialog', m)) || $('.modal__dialog', m)).focus(), 50);
    }
    function close(keepLock) {
      if (!active) return;
      active.classList.remove('is-open');
      active.setAttribute('aria-hidden', 'true');
      active = null;
      if (!keepLock) {
        document.body.classList.remove('is-locked');
        lastFocus && lastFocus.focus && lastFocus.focus();
      }
    }

    document.addEventListener('click', e => {
      const o = e.target.closest('[data-modal-open]');
      if (o) { e.preventDefault(); open(o.dataset.modalOpen); return; }
      if (e.target.closest('[data-modal-close]')) close();
    });
    document.addEventListener('keydown', e => {
      if (!active) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // focus trap
        const els = $$(focusable, active).filter(el => el.offsetParent !== null);
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Reserve form (demo validation)
    const form = $('#reserveForm');
    const err = $('#formError');
    const done = $('#formDone');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const name = form.elements.name, tel = form.elements.tel;
      const ng = [name, tel].filter(i => !i.value.trim());
      [name, tel].forEach(i => i.classList.toggle('is-error', ng.includes(i)));
      err.hidden = ng.length === 0;
      if (ng.length) { ng[0].focus(); return; }
      form.hidden = true;
      $('.modal__lead', $('#modal-reserve')).hidden = true;
      done.hidden = false;
    });
  })();

  /* ===== 6. Header shadow / back-to-top / reveal ===== */
  const header = $('#header');
  const totop = $('#totop');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 10);
    totop.classList.toggle('is-show', y > 600);
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: .15 });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-visible'));
  }
})();
