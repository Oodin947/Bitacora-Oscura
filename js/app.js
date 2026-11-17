/* ==========================================================================
   Main Application — Editorial Feed, Bento Grid, Single Post Reader
   ========================================================================== */

(() => {
const { INITIAL_POSTS, QUICK_NOTES, ABOUT_PILLARS, loadStore, escapeHtml, sanitizeUrl } = window.EditorialBlog.data;
const { initVideoObservers, initLightbox, initPdfViewer } = window.EditorialBlog.media;
const {
  runViewTransition,
  initScrollProgress,
  initSpotlightCards,
  initRevealMasks,
  initMagneticCursor,
  initSearchModal,
  initTocObserver
} = window.EditorialBlog.interactions;

const initialStore = loadStore();
let posts = initialStore.posts;
let pillars = initialStore.pillars;
let activeFilter = 'all';
let activePillarKey = pillars[0]?.key || 'diseno';

const LIKED_KEY = 'bitacora_liked_posts_v1';
const LOCAL_ENGAGEMENT_KEY = 'bitacora_local_engagement_v1';
let likesMap = {};

function getLikedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'));
  } catch (_) {
    return new Set();
  }
}

function saveLikedSet(set) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
  } catch (_) {}
}

function getLocalEngagement() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ENGAGEMENT_KEY) || '{"likes":{},"comments":{}}');
  } catch (_) {
    return { likes: {}, comments: {} };
  }
}

function saveLocalEngagement(data) {
  try {
    localStorage.setItem(LOCAL_ENGAGEMENT_KEY, JSON.stringify(data));
  } catch (_) {}
}

async function fetchRemoteContent() {
  try {
    const res = await fetch('/api/content');
    if (!res.ok) return;
    const data = await res.json();
    let changed = false;
    if (Array.isArray(data.posts)) {
      posts = data.posts;
      changed = true;
    }
    if (Array.isArray(data.pillars) && data.pillars.length) {
      pillars = data.pillars;
      changed = true;
    }
    if (changed) {
      renderHero();
      renderFilters();
      renderBentoGrid();
      if (aboutContainer && !aboutContainer.classList.contains('is-hidden')) {
        renderAboutSection();
      }
    }
  } catch (_) {}
}

async function fetchAllLikes() {
  try {
    const res = await fetch('/api/engagement');
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    likesMap = data.likes || {};
    renderBentoGrid();
  } catch (_) {
    likesMap = getLocalEngagement().likes || {};
  }
}

function renderLikeButton(postId) {
  const liked = getLikedSet().has(postId);
  const count = Number(likesMap[postId]) || 0;
  return `
    <button
      class="like-btn ${liked ? 'is-liked' : ''}"
      data-like-btn="${escapeHtml(postId)}"
      data-cursor="Me gusta"
      type="button"
      aria-pressed="${liked}"
      aria-label="Me gusta"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span data-like-count="${escapeHtml(postId)}">${count}</span>
    </button>
  `;
}

async function handleLikeToggle(postId) {
  const likedSet = getLikedSet();
  const alreadyLiked = likedSet.has(postId);
  const delta = alreadyLiked ? -1 : 1;

  if (alreadyLiked) likedSet.delete(postId);
  else likedSet.add(postId);
  saveLikedSet(likedSet);

  const nextCount = Math.max(0, (Number(likesMap[postId]) || 0) + delta);
  likesMap[postId] = nextCount;

  document.querySelectorAll(`[data-like-btn="${postId}"]`).forEach((btn) => {
    btn.classList.toggle('is-liked', !alreadyLiked);
    btn.setAttribute('aria-pressed', String(!alreadyLiked));
  });
  document.querySelectorAll(`[data-like-count="${postId}"]`).forEach((el) => {
    el.textContent = String(nextCount);
  });

  try {
    const res = await fetch('/api/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'like', postId, delta })
    });
    if (res.ok) {
      const data = await res.json();
      likesMap[postId] = Number(data.likesCount) || 0;
      document.querySelectorAll(`[data-like-count="${postId}"]`).forEach((el) => {
        el.textContent = String(likesMap[postId]);
      });
      return;
    }
  } catch (_) {}

  const local = getLocalEngagement();
  local.likes[postId] = nextCount;
  saveLocalEngagement(local);
}

const feedView = document.getElementById('feed-view');
const postView = document.getElementById('post-view');
const heroContainer = document.getElementById('hero-editorial');
const aboutContainer = document.getElementById('quienes-somos');
const privacyContainer = document.getElementById('privacidad-view');
const bentoContainer = document.getElementById('bento-grid');
const filterContainer = document.getElementById('filter-pills');

function renderHero() {
  if (!heroContainer) return;
  const featured = posts.find((p) => p.featured) || posts[0];

  if (!featured) {
    heroContainer.classList.add('is-hidden');
    heroContainer.innerHTML = '';
    return;
  }

  heroContainer.classList.remove('is-hidden');
  const safeCover = sanitizeUrl(featured.cover);
  const safeId = escapeHtml(featured.id);
  const safeTitle = escapeHtml(featured.title);
  const safeAlt = escapeHtml(featured.coverAlt || featured.title);

  heroContainer.innerHTML = `
    <article class="glass-card hero-featured" data-open-post="${safeId}" data-cursor="Leer ensayo" style="cursor:pointer;">
      <div>
        ${
          safeCover
            ? `<div class="hero-featured__media" style="view-transition-name: hero-cover;">
                <picture>
                  <img src="${safeCover}" alt="${safeAlt}" loading="eager" />
                </picture>
              </div>`
            : ''
        }
        <div class="meta-row" style="margin-bottom:0.85rem;">
          <span class="meta-tag meta-tag--accent"><span class="meta-dot"></span>Destacado</span>
          <span>${escapeHtml(featured.category)}</span>
          <span>·</span>
          <span>${escapeHtml(featured.date)}</span>
          <span>·</span>
          <span>${escapeHtml(featured.readTime)}</span>
        </div>
        <h1 class="hero-featured__title reveal-mask">${safeTitle}</h1>
        <p class="hero-featured__excerpt">${escapeHtml(featured.excerpt)}</p>
      </div>
      <div class="bento-card__footer">
        <span>BITÁCORA OSCURA</span>
        <span style="color:var(--accent-bright);">Abrir lectura →</span>
      </div>
    </article>

    <aside class="glass-card hero-log" aria-label="Bitácora rápida">
      <div class="hero-log__header">
        <span class="meta-row" style="color:var(--text-primary);">Bitácora rápida</span>
        <span class="meta-tag">${QUICK_NOTES.length} NOTAS</span>
      </div>
      <div class="hero-log__list">
        ${
          QUICK_NOTES.length
            ? QUICK_NOTES.map(
                (note) => `
          <button class="log-item" data-open-post="${escapeHtml(note.targetPostId)}" data-cursor="Ir a nota">
            <div class="meta-row">
              <span style="color:var(--accent-bright);">${escapeHtml(note.tag)}</span>
              <span>·</span>
              <span>${escapeHtml(note.date)}</span>
            </div>
            <div class="log-item__title">${escapeHtml(note.title)}</div>
            <p class="log-item__summary">${escapeHtml(note.summary)}</p>
          </button>
        `
              ).join('')
            : `<p style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted);padding:0.5rem 0;">Sin notas recientes.</p>`
        }
      </div>
    </aside>
  `;
}

function renderBentoCard(post) {
  const safeId = escapeHtml(post.id);
  const safeTitle = escapeHtml(post.title);
  const safeExcerpt = escapeHtml(post.excerpt);
  const safeCategory = escapeHtml(post.category);
  const safeDate = escapeHtml(post.date);
  const safeReadTime = escapeHtml(post.readTime);
  const safeSpan = escapeHtml(post.bentoSpan || '');

  if (post.type === 'video') {
    const safeVideo = sanitizeUrl(post.videoSrc, false);
    const srcAttr = safeVideo && !safeVideo.startsWith('procedural://') ? `src="${safeVideo}"` : '';
    return `
      <article class="glass-card bento-card ${safeSpan || 'bento-span-5'}">
        <div class="bento-card__media bento-card__media--reel" data-cursor="Reproducir">
          <span class="video-status-pill">EN PAUSA</span>
          <video data-smart-video data-src="${safeVideo}" ${srcAttr} muted loop playsinline preload="metadata"></video>
          <button class="video-audio-btn" data-audio-toggle type="button">Audio: OFF</button>
        </div>
        <div class="meta-row">
          <span class="meta-tag meta-tag--accent">${safeCategory}</span>
          <span>${safeDate}</span>
        </div>
        <h3 class="bento-card__title reveal-mask">${safeTitle}</h3>
        <p class="bento-card__excerpt">${safeExcerpt}</p>
        <div class="bento-card__footer">
          ${renderLikeButton(post.id)}
          <button class="btn-glass" data-open-post="${safeId}" type="button">Ver ficha →</button>
        </div>
      </article>
    `;
  }

  if (post.type === 'pdf') {
    const meta = post.pdfMeta || { pages: '—', size: 'PDF', format: 'PDF', code: 'DOC' };
    const safePdfUrl = sanitizeUrl(post.pdfUrl, false);
    return `
      <article class="glass-card pdf-spec-card ${safeSpan || 'bento-span-7'}" data-cursor="Ver PDF">
        <div>
          <div class="meta-row" style="margin-bottom:0.85rem;">
            <span class="meta-tag meta-tag--accent">${safeCategory}</span>
            <span>${safeDate}</span>
            <span>·</span>
            <span>${safeReadTime}</span>
          </div>
          <div class="pdf-spec-card__preview" data-open-pdf="${safePdfUrl}" data-pdf-title="${safeTitle}" style="cursor:pointer;">
            <div class="pdf-thumb">
              <div class="pdf-thumb__lines">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
              <span class="pdf-thumb__badge">${escapeHtml(meta.code)}</span>
            </div>
            <div>
              <h3 class="bento-card__title reveal-mask" style="margin-top:0;">${safeTitle}</h3>
              <p class="bento-card__excerpt" style="margin-bottom:0.85rem;">${safeExcerpt}</p>
              <div class="pdf-spec-meta">
                <div><span>Páginas</span><strong>${escapeHtml(meta.pages)}</strong></div>
                <div><span>Peso</span><strong>${escapeHtml(meta.size)}</strong></div>
              </div>
            </div>
          </div>
        </div>
        <div class="bento-card__footer">
          <span>VISOR PDF.JS OSCURO</span>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn-glass" data-open-pdf="${safePdfUrl}" data-pdf-title="${safeTitle}" type="button">Abrir visor PDF</button>
            <button class="btn-glass" data-open-post="${safeId}" type="button">Notas →</button>
          </div>
        </div>
      </article>
    `;
  }

  const safeCover = sanitizeUrl(post.cover);
  const safeAlt = escapeHtml(post.coverAlt || post.title);
  return `
    <article class="glass-card bento-card ${safeSpan || 'bento-span-6'}" data-open-post="${safeId}" data-cursor="Leer" style="cursor:pointer;">
      ${
        safeCover
          ? `<div class="bento-card__media bento-card__media--landscape">
              <picture>
                <img src="${safeCover}" alt="${safeAlt}" loading="lazy" />
              </picture>
            </div>`
          : ''
      }
      <div class="meta-row">
        <span class="meta-tag">${safeCategory}</span>
        <span>${safeDate}</span>
      </div>
      <h3 class="bento-card__title reveal-mask">${safeTitle}</h3>
      <p class="bento-card__excerpt">${safeExcerpt}</p>
      <div class="bento-card__footer">
        ${renderLikeButton(post.id)}
        <span style="color:var(--accent-bright);">Leer artículo →</span>
      </div>
    </article>
  `;
}

function renderBentoGrid() {
  if (!bentoContainer) return;
  const nonFeatured = posts.filter((p) => !p.featured);
  const filtered =
    activeFilter === 'all' ? nonFeatured : posts.filter((p) => p.type === activeFilter);

  if (!filtered.length) {
    bentoContainer.innerHTML = `
      <div class="glass-card bento-span-12" style="grid-column:1 / -1;padding:2.5rem;text-align:center;">
        <p style="font-family:var(--font-display);font-size:1.6rem;color:var(--text-primary);margin-bottom:0.4rem;">
          Espacio editorial limpio
        </p>
        <p style="font-family:var(--font-mono);font-size:0.76rem;color:var(--text-muted);">
          Aún no hay publicaciones en esta sección.
        </p>
      </div>
    `;
    return;
  }

  bentoContainer.innerHTML = filtered.map(renderBentoCard).join('');
  bindDynamicTriggers();
  initRevealMasks();
  initVideoObservers();
}

function renderFilters() {
  if (!filterContainer) return;
  const filters = [
    { key: 'all', label: 'Todo (News)' },
    { key: 'essay', label: 'Blog' },
    { key: 'video', label: 'Tutoriales' },
    { key: 'pdf', label: 'Documentos' }
  ];

  filterContainer.innerHTML = filters
    .map(
      (f) =>
        `<button class="btn-glass ${activeFilter === f.key ? 'is-active' : ''}" data-filter="${f.key}" type="button">${f.label}</button>`
    )
    .join('');

  filterContainer.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderFilters();
      renderBentoGrid();
    });
  });
}

function openPost(postId) {
  const post = posts.find((p) => p.id === postId);
  if (!post || !feedView || !postView) return;

  runViewTransition(() => {
    feedView.classList.add('is-hidden');
    aboutContainer?.classList.add('is-hidden');
    privacyContainer?.classList.add('is-hidden');
    postView.classList.remove('is-hidden');

    const tocItems = (post.sections || [])
      .map((s, idx) => `<li><a class="post-toc__link ${idx === 0 ? 'is-active' : ''}" href="#${escapeHtml(s.id)}">${escapeHtml(s.heading)}</a></li>`)
      .join('');

    const sectionsHtml = (post.sections || [])
      .map(
        (s) => `
        <section>
          <h2 id="${escapeHtml(s.id)}">${escapeHtml(s.heading)}</h2>
          ${(s.body || []).map((par) => `<p>${escapeHtml(par)}</p>`).join('')}
          ${s.quote ? `<blockquote>“${escapeHtml(s.quote)}”</blockquote>` : ''}
          ${
            s.figure && sanitizeUrl(s.figure.src)
              ? `<figure data-cursor="Ampliar" data-lightbox-src="${sanitizeUrl(s.figure.src)}" data-lightbox-cap="${escapeHtml(s.figure.caption)}" style="cursor:zoom-in;">
                  <picture>
                    <img src="${sanitizeUrl(s.figure.src)}" alt="${escapeHtml(s.figure.caption)}" loading="lazy" style="border-radius:var(--radius-md);border:1px solid var(--border-subtle);" />
                  </picture>
                  <figcaption>${escapeHtml(s.figure.caption)}</figcaption>
                </figure>`
              : ''
          }
        </section>
      `
      )
      .join('');

    const safeCover = sanitizeUrl(post.cover);
    const safeTitle = escapeHtml(post.title);
    const safePdfUrl = sanitizeUrl(post.pdfUrl, false);

    postView.innerHTML = `
      <div class="post-view__topbar">
        <button class="btn-glass" id="back-to-feed" type="button">← Volver al índice</button>
        <div class="meta-row">
          <span class="meta-tag meta-tag--accent">${escapeHtml(post.category)}</span>
          <span>${escapeHtml(post.date)}</span>
          <span>·</span>
          <span>${escapeHtml(post.readTime)}</span>
        </div>
      </div>

      <header class="post-hero">
        <h1 class="post-hero__title">${safeTitle}</h1>
        <p class="post-hero__subtitle">${escapeHtml(post.excerpt)}</p>
        ${
          safeCover
            ? `<div class="post-hero__cover" style="view-transition-name: hero-cover;" data-cursor="Ampliar" data-lightbox-src="${safeCover}" data-lightbox-cap="${safeTitle}">
                <img src="${safeCover}" alt="${escapeHtml(post.coverAlt || post.title)}" style="cursor:zoom-in;" />
              </div>`
            : ''
        }
      </header>

      <div class="post-layout">
        <aside class="glass-card post-toc" aria-label="Índice del artículo">
          <div class="post-toc__label">Índice</div>
          <ul class="post-toc__list">${tocItems}</ul>
        </aside>

        <article class="post-prose">
          ${
            post.type === 'pdf'
              ? `<div style="margin-bottom:2rem;">
                  <button class="btn-glass is-active" data-open-pdf="${safePdfUrl}" data-pdf-title="${safeTitle}" type="button">Abrir documento en visor PDF.js oscuro</button>
                </div>`
              : ''
          }
          ${sectionsHtml}

          <section class="post-engagement" id="post-engagement" aria-label="Interacción y comentarios">
            <div class="post-engagement__bar">
              <div>
                <h2 style="margin-top:0;margin-bottom:0.2rem;">Conversación</h2>
                <p style="margin:0;font-family:var(--font-mono);font-size:0.74rem;color:var(--text-muted);">
                  Deja tu opinión o reacciona a esta publicación.
                </p>
              </div>
              ${renderLikeButton(post.id)}
            </div>

            <form class="glass-card comments-form" id="comment-form">
              <div style="display:grid;grid-template-columns:1fr;gap:0.75rem;">
                <div>
                  <label class="field-label" for="comment-author">Tu nombre</label>
                  <input class="field-input" id="comment-author" type="text" maxlength="60" placeholder="Ej. Sofía M." required />
                </div>
                <div>
                  <label class="field-label" for="comment-body">Comentario</label>
                  <textarea class="field-textarea" id="comment-body" maxlength="1000" style="min-height:92px;" placeholder="Escribe tu comentario aquí…" required></textarea>
                </div>
              </div>
              <div style="display:flex;justify-content:flex-end;">
                <button class="btn-glass is-active" type="submit">Publicar comentario</button>
              </div>
            </form>

            <div class="comments-list" id="comments-list">
              <p style="font-family:var(--font-mono);font-size:0.76rem;color:var(--text-muted);">Cargando comentarios…</p>
            </div>
          </section>
        </article>

        <div class="post-layout__spacer" aria-hidden="true"></div>
      </div>
    `;

    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('back-to-feed')?.addEventListener('click', closePost);
    bindDynamicTriggers();
    initTocObserver();
    initPostEngagement(post.id);
  });
}

async function initPostEngagement(postId) {
  const listEl = document.getElementById('comments-list');
  const formEl = document.getElementById('comment-form');
  const authorInput = document.getElementById('comment-author');
  const bodyInput = document.getElementById('comment-body');
  if (!listEl) return;

  const renderComments = (comments) => {
    if (!comments.length) {
      listEl.innerHTML = `<p style="font-family:var(--font-mono);font-size:0.76rem;color:var(--text-muted);">Sé la primera persona en comentar.</p>`;
      return;
    }
    listEl.innerHTML = comments
      .map((c) => {
        const dateStr = c.created_at
          ? new Date(c.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
          : 'RECIENTE';
        return `
          <div class="comment-item">
            <div class="comment-item__head">
              <span class="comment-item__author">${escapeHtml(c.author)}</span>
              <span class="comment-item__date">${escapeHtml(dateStr)}</span>
            </div>
            <p class="comment-item__body">${escapeHtml(c.body)}</p>
          </div>
        `;
      })
      .join('');
  };

  let comments = [];
  try {
    const res = await fetch(`/api/engagement?postId=${encodeURIComponent(postId)}`);
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    likesMap[postId] = Number(data.likesCount) || 0;
    document.querySelectorAll(`[data-like-count="${postId}"]`).forEach((el) => {
      el.textContent = String(likesMap[postId]);
    });
    comments = Array.isArray(data.comments) ? data.comments : [];
  } catch (_) {
    comments = getLocalEngagement().comments?.[postId] || [];
  }
  renderComments(comments);

  formEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = authorInput?.value.trim();
    const body = bodyInput?.value.trim();
    if (!author || !body) return;

    let created = null;
    try {
      const res = await fetch('/api/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', postId, author, body })
      });
      if (res.ok) {
        const data = await res.json();
        created = data.comment;
      }
    } catch (_) {}

    if (!created) {
      created = { id: Date.now(), author, body, created_at: new Date().toISOString() };
      const local = getLocalEngagement();
      local.comments[postId] = [created, ...(local.comments[postId] || [])];
      saveLocalEngagement(local);
    }

    comments = [created, ...comments];
    renderComments(comments);
    authorInput.value = '';
    bodyInput.value = '';
  });
}

function closePost() {
  if (!feedView || !postView) return;
  runViewTransition(() => {
    postView.classList.add('is-hidden');
    postView.innerHTML = '';
    feedView.classList.remove('is-hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
    initVideoObservers();
  });
}

function bindDynamicTriggers() {
  document.querySelectorAll('[data-open-post]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-pdf]') || e.target.closest('[data-audio-toggle]') || e.target.closest('[data-like-btn]')) return;
      openPost(el.dataset.openPost);
    });
  });

  document.querySelectorAll('[data-like-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLikeToggle(btn.dataset.likeBtn);
    });
  });

  document.querySelectorAll('[data-open-pdf]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      window.openPdfModal?.(el.dataset.openPdf, el.dataset.pdfTitle);
    });
  });

  document.querySelectorAll('[data-lightbox-src]').forEach((el) => {
    el.addEventListener('click', () => {
      window.openLightbox?.(el.dataset.lightboxSrc, el.dataset.lightboxCap);
    });
  });
}

function setActiveNav(el) {
  document.querySelectorAll('.site-nav__link').forEach((l) => l.classList.remove('is-active'));
  if (el) el.classList.add('is-active');
}

function openAboutView() {
  if (!aboutContainer || !feedView || !postView) return;
  runViewTransition(() => {
    feedView.classList.add('is-hidden');
    postView.classList.add('is-hidden');
    privacyContainer?.classList.add('is-hidden');
    postView.innerHTML = '';
    aboutContainer.classList.remove('is-hidden');
    renderAboutSection();
    setActiveNav(document.getElementById('nav-about'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
}

function openPrivacyView() {
  if (!privacyContainer || !feedView || !postView) return;
  runViewTransition(() => {
    feedView.classList.add('is-hidden');
    postView.classList.add('is-hidden');
    aboutContainer?.classList.add('is-hidden');
    postView.innerHTML = '';
    privacyContainer.classList.remove('is-hidden');
    renderPrivacySection();
    setActiveNav(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
}

function closePrivacyView() {
  if (!privacyContainer || !feedView) return;
  runViewTransition(() => {
    privacyContainer.classList.add('is-hidden');
    feedView.classList.remove('is-hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
    initVideoObservers();
  });
}

function renderPrivacySection() {
  if (!privacyContainer) return;
  privacyContainer.innerHTML = `
    <div class="post-view__topbar">
      <button class="btn-glass" id="privacy-back-btn" type="button">← Volver al inicio</button>
      <div class="meta-row">
        <span class="meta-tag meta-tag--accent">Privacidad</span>
        <span>Bitácora Oscura · Marzo 2026</span>
      </div>
    </div>

    <div class="glass-card about-shell">
      <div class="about-intro">
        <div>
          <div class="meta-row">
            <span class="meta-tag meta-tag--accent"><span class="meta-dot"></span>Aviso de Privacidad</span>
            <span>By OdinModding</span>
          </div>
          <h2 class="about-intro__title">
            Lectura libre de rastreo, <em>sin cookies invasivas</em> ni venta de datos.
          </h2>
          <p class="about-intro__copy" style="margin-top:1rem;">
            En Bitácora Oscura respetamos tu atención y tu privacidad. Este sitio editorial no utiliza rastreadores publicitarios, perfiles ocultos ni analítica intrusiva de terceros.
          </p>
        </div>
        <div class="meta-row">Última actualización · Marzo 2026</div>
      </div>

      <div class="about-stage">
        <div class="about-stage__content">
          <div class="meta-row">
            <span style="color:var(--accent-bright);">TRANSPARENCIA TÉCNICA</span>
          </div>
          <h3 class="about-stage__heading">Cómo tratamos la información</h3>
          <p class="about-stage__desc">
            La experiencia pública funciona íntegramente en tu navegador sin recopilar datos personales.
          </p>
          <ul class="about-list">
            <li>Sin cookies de seguimiento ni píxeles publicitarios</li>
            <li>Los enlaces a WhatsApp e Instagram son externos y opcionales</li>
            <li>Los documentos PDF y medios se visualizan de forma local y segura</li>
          </ul>
        </div>
        <div class="about-stage__footer">
          <span style="font-style:italic;color:var(--text-secondary);">“Tu lectura es tuya, nunca un producto.”</span>
          <button class="btn-glass" id="privacy-home-btn" type="button">Explorar News →</button>
        </div>
      </div>
    </div>
  `;

  const goHome = () => {
    setActiveNav(document.querySelector('[data-nav-filter="all"]'));
    closePrivacyView();
  };
  document.getElementById('privacy-back-btn')?.addEventListener('click', goHome);
  document.getElementById('privacy-home-btn')?.addEventListener('click', goHome);
}

function closeAboutView() {
  if (!aboutContainer || !feedView) return;
  runViewTransition(() => {
    aboutContainer.classList.add('is-hidden');
    feedView.classList.remove('is-hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
    initVideoObservers();
  });
}

function renderAboutSection() {
  if (!aboutContainer) return;
  const activeIndex = pillars.findIndex((p) => p.key === activePillarKey);
  const pillar = pillars[activeIndex >= 0 ? activeIndex : 0];
  const nextPillar = pillars[(activeIndex + 1) % pillars.length];

  aboutContainer.innerHTML = `
    <div class="post-view__topbar">
      <button class="btn-glass" id="about-back-btn" type="button">← Volver al archivo</button>
      <div class="meta-row">
        <span class="meta-tag meta-tag--accent">Bitácora Oscura</span>
        <span>Diseño · Código · Capacitación</span>
      </div>
    </div>

    <div class="glass-card about-shell">
      <div class="about-intro">
        <div>
          <div class="meta-row">
            <span class="meta-tag meta-tag--accent"><span class="meta-dot"></span>Quiénes somos</span>
            <span>Taller Digital</span>
          </div>
          <h2 class="about-intro__title">
            Unimos <em>diseño</em>, código y capacitación con oficio humano.
          </h2>
          <p class="about-intro__copy" style="margin-top:1rem;">
            Bitácora Oscura nace como un espacio vivo de estudio y práctica. No perseguimos tendencias pasajeras ni fórmulas automáticas: pensamos interfaces con calma, escribimos software honesto y compartimos lo que aprendemos en el camino.
          </p>
        </div>

        <div>
          <div class="meta-row" style="margin-bottom:0.65rem;">Explora nuestros pilares</div>
          <div class="about-tabs" role="tablist" aria-label="Pilares de Bitácora Oscura">
            ${pillars.map(
              (p) => `
              <button
                class="about-tab ${p.key === pillar.key ? 'is-active' : ''}"
                data-about-tab="${escapeHtml(p.key)}"
                data-cursor="Explorar"
                role="tab"
                aria-selected="${p.key === pillar.key}"
                type="button"
              >
                <span style="color:var(--text-muted);">${escapeHtml(p.index)}</span>
                <span>${escapeHtml(p.label)}</span>
              </button>
            `
            ).join('')}
          </div>
        </div>
      </div>

      <div class="about-stage" role="tabpanel">
        <div class="about-stage__content" key="${escapeHtml(pillar.key)}">
          <div class="meta-row">
            <span style="color:var(--accent-bright);">${escapeHtml(pillar.index)} · ${escapeHtml(pillar.eyebrow)}</span>
          </div>
          <h3 class="about-stage__heading">${escapeHtml(pillar.heading)}</h3>
          <p class="about-stage__desc">${escapeHtml(pillar.description)}</p>
          <ul class="about-list">
            ${pillar.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('')}
          </ul>
        </div>
        <div class="about-stage__footer">
          <span style="font-style:italic;color:var(--text-secondary);">${escapeHtml(pillar.note)}</span>
          <button class="btn-glass" data-about-tab="${escapeHtml(nextPillar.key)}" type="button">
            Siguiente: ${escapeHtml(nextPillar.label)} →
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('about-back-btn')?.addEventListener('click', () => {
    setActiveNav(document.querySelector('[data-nav-filter="all"]'));
    closeAboutView();
  });

  aboutContainer.querySelectorAll('[data-about-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activePillarKey = btn.dataset.aboutTab;
      renderAboutSection();
    });
  });
}

function init() {
  renderHero();
  renderFilters();
  renderBentoGrid();
  fetchRemoteContent();
  fetchAllLikes();

  initScrollProgress();
  initSpotlightCards();
  initMagneticCursor();
  initLightbox();
  initPdfViewer();
  initSearchModal(() => posts, openPost);

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  const closeMobileMenu = () => {
    mobileDrawer?.classList.add('is-hidden');
    mobileMenuBtn?.setAttribute('aria-expanded', 'false');
  };

  mobileMenuBtn?.addEventListener('click', () => {
    const isHidden = mobileDrawer?.classList.toggle('is-hidden');
    mobileMenuBtn.setAttribute('aria-expanded', String(!isHidden));
  });

  // Brand logo returns to feed
  document.getElementById('brand-home')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMobileMenu();
    setActiveNav(document.querySelector('[data-nav-filter="all"]'));
    if (!postView.classList.contains('is-hidden')) closePost();
    if (aboutContainer && !aboutContainer.classList.contains('is-hidden')) closeAboutView();
    if (privacyContainer && !privacyContainer.classList.contains('is-hidden')) closePrivacyView();
  });

  // Dedicated Quiénes somos nav link (desktop + mobile)
  document.querySelectorAll('#nav-about, [data-mobile-about]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileMenu();
      openAboutView();
    });
  });

  // Dedicated Privacidad footer link
  document.getElementById('footer-privacy-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMobileMenu();
    openPrivacyView();
  });

  // Nav filter shortcuts (desktop + mobile)
  document.querySelectorAll('[data-nav-filter]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileMenu();
      setActiveNav(link);
      if (!postView.classList.contains('is-hidden')) closePost();
      if (aboutContainer && !aboutContainer.classList.contains('is-hidden')) closeAboutView();
      if (privacyContainer && !privacyContainer.classList.contains('is-hidden')) closePrivacyView();
      activeFilter = link.dataset.navFilter;
      renderFilters();
      renderBentoGrid();
      setTimeout(() => {
        document.getElementById('archivo-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
})();
