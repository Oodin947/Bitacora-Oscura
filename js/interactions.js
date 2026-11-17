/* ==========================================================================
   Interactions — Spotlight, Reveals, Magnetic Cursor, Progress, Cmd+K, TOC
   ========================================================================== */

window.EditorialBlog = window.EditorialBlog || {};

(() => {
function runViewTransition(updateFn) {
  if (typeof document.startViewTransition === 'function') {
    return document.startViewTransition(updateFn);
  }
  updateFn();
  return null;
}

/* 2px Reading Progress Bar */
function initScrollProgress() {
  const bar = document.getElementById('reading-progress-bar');
  if (!bar) return;

  const update = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    bar.style.width = `${pct.toFixed(2)}%`;
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* Spotlight Radial Border Glow (--mouse-x, --mouse-y) */
function initSpotlightCards() {
  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.glass-card');
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });
}

/* Clip-path Editorial Text Reveal */
let revealObserver = null;
function initRevealMasks() {
  if (revealObserver) revealObserver.disconnect();

  const targets = document.querySelectorAll('.reveal-mask');
  if (!targets.length) return;

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  targets.forEach((el) => revealObserver.observe(el));
}

/* Custom Magnetic Context Cursor Pill (Desktop) */
function initMagneticCursor() {
  const pill = document.getElementById('cursor-pill');
  if (!pill || window.matchMedia('(hover: none)').matches) return;

  let mouseX = -100;
  let mouseY = -100;
  let currX = -100;
  let currY = -100;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    const target = e.target.closest('[data-cursor]');
    if (target) {
      pill.textContent = target.dataset.cursor;
      pill.classList.add('is-visible');
    } else {
      pill.classList.remove('is-visible');
    }
  });

  document.addEventListener('mouseleave', () => pill.classList.remove('is-visible'));

  // Subtle magnetic pull on brand capsule
  const brand = document.getElementById('brand-home');
  if (brand) {
    brand.addEventListener('mousemove', (e) => {
      const rect = brand.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
      const dy = ((e.clientY - rect.top) / rect.height - 0.5) * 6;
      brand.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    });
    brand.addEventListener('mouseleave', () => {
      brand.style.transform = '';
    });
  }

  function tick() {
    currX += (mouseX - currX) * 0.22;
    currY += (mouseY - currY) * 0.22;
    pill.style.left = `${currX}px`;
    pill.style.top = `${currY - 22}px`;
    requestAnimationFrame(tick);
  }
  tick();
}

/* Command-K Quick Search Modal */
function initSearchModal(getPosts, onSelectPost) {
  const modal = document.getElementById('search-modal');
  const trigger = document.getElementById('search-trigger');
  const input = document.getElementById('search-input');
  const resultsEl = document.getElementById('search-results');

  if (!modal || !input || !resultsEl) return;

  const renderResults = (query = '') => {
    const q = query.trim().toLowerCase();
    const posts = getPosts().filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );

    const esc = window.EditorialBlog.data?.escapeHtml || ((v) => String(v ?? ''));
    if (!posts.length) {
      resultsEl.innerHTML = `<p style="padding:1.25rem;color:var(--text-muted);font-family:var(--font-mono);font-size:0.8rem;">Sin resultados para "${esc(query)}".</p>`;
      return;
    }

    resultsEl.innerHTML = posts
      .map(
        (p) => `
        <button class="search-result-item" data-search-id="${esc(p.id)}">
          <div>
            <div class="search-result-item__title">${esc(p.title)}</div>
            <div class="meta-row" style="margin-top:0.25rem;">
              <span>${esc(p.category)}</span>
              <span>·</span>
              <span>${esc(p.date)}</span>
            </div>
          </div>
          <span class="kbd-hint">↵</span>
        </button>
      `
      )
      .join('');

    resultsEl.querySelectorAll('[data-search-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        close();
        onSelectPost(btn.dataset.searchId);
      });
    });
  };

  const open = () => {
    modal.classList.add('is-open');
    input.value = '';
    renderResults('');
    setTimeout(() => input.focus(), 40);
  };

  const close = () => modal.classList.remove('is-open');

  trigger?.addEventListener('click', open);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  input.addEventListener('input', (e) => renderResults(e.target.value));

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      modal.classList.contains('is-open') ? close() : open();
    } else if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      close();
    }
  });
}

/* Sticky Table of Contents Observer for Single Post */
let tocObserver = null;
function initTocObserver() {
  if (tocObserver) tocObserver.disconnect();
  const headings = document.querySelectorAll('.post-prose h2[id]');
  const links = document.querySelectorAll('.post-toc__link');
  if (!headings.length || !links.length) return;

  tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('is-active'));
          const active = document.querySelector(`.post-toc__link[href="#${entry.target.id}"]`);
          if (active) active.classList.add('is-active');
        }
      });
    },
    { rootMargin: '-20% 0px -65% 0px' }
  );

  headings.forEach((h) => tocObserver.observe(h));
}

window.EditorialBlog.interactions = {
  runViewTransition,
  initScrollProgress,
  initSpotlightCards,
  initRevealMasks,
  initMagneticCursor,
  initSearchModal,
  initTocObserver
};
})();
