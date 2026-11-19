/* ==========================================================================
   Dedicated Admin Page Controller (admin.html)
   Server-verified Auth + Netlify Database Sync + Local Fallback
   ========================================================================== */

window.EditorialBlog = window.EditorialBlog || {};

(() => {
const LOCAL_FALLBACK_PASS_KEY = 'bitacora_local_passcode_v1';
const DEFAULT_PASSCODE = 'bitacora2026';
const TOKEN_KEY = 'bitacora_admin_token';

function initAdminPage() {
  const { QUICK_NOTES, loadStore, saveStore, resetStore, escapeHtml, sanitizeUrl, sanitizeRichHtml } = window.EditorialBlog.data;
  let state = loadStore();

  const loginView = document.getElementById('admin-login-view');
  const loginForm = document.getElementById('admin-login-form');
  const passcodeInput = document.getElementById('admin-passcode');
  const loginError = document.getElementById('admin-login-error');

  const dashboardView = document.getElementById('admin-dashboard-view');
  const saveBadge = document.getElementById('admin-save-badge');
  const tabPostsBtn = document.getElementById('admin-tab-posts');
  const tabAboutBtn = document.getElementById('admin-tab-about');
  const tabSettingsBtn = document.getElementById('admin-tab-settings');
  const panelPosts = document.getElementById('admin-panel-posts');
  const panelAbout = document.getElementById('admin-panel-about');
  const panelSettings = document.getElementById('admin-panel-settings');

  const postListEl = document.getElementById('admin-post-list');
  const newPostBtn = document.getElementById('admin-new-post');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const resetBtn = document.getElementById('admin-reset-btn');

  const dropzone = document.getElementById('composer-dropzone');
  const fileInput = document.getElementById('composer-file');
  const fileStatus = document.getElementById('composer-file-status');
  const previewEl = document.getElementById('composer-preview');

  const titleInput = document.getElementById('comp-title');
  const typeSelect = document.getElementById('comp-type');
  const catInput = document.getElementById('comp-category');
  const excerptInput = document.getElementById('comp-excerpt');
  const editorEl = document.getElementById('comp-editor');
  const toolbarEl = document.getElementById('rich-toolbar');

  const publishBtn = document.getElementById('comp-publish');
  const exportJsonBtn = document.getElementById('comp-export-json');
  const exportHtmlBtn = document.getElementById('comp-export-html');

  const aboutPillsEl = document.getElementById('admin-about-pills');
  const aboutHeadingInput = document.getElementById('admin-about-heading');
  const aboutDescInput = document.getElementById('admin-about-desc');
  const aboutPointsInput = document.getElementById('admin-about-points');
  const aboutNoteInput = document.getElementById('admin-about-note');
  const aboutSaveBtn = document.getElementById('admin-about-save');

  const passForm = document.getElementById('admin-password-form');
  const currPassInput = document.getElementById('admin-curr-pass');
  const newPassInput = document.getElementById('admin-new-pass');
  const confirmPassInput = document.getElementById('admin-confirm-pass');
  const passMsgEl = document.getElementById('admin-pass-msg');

  if (!loginView || !dashboardView) return;

  let editingPostId = null;
  let attachedMedia = null;
  let editingPillarKey = state.pillars[0]?.key || 'diseno';

  const getToken = () => sessionStorage.getItem(TOKEN_KEY) || '';
  const isAuthenticated = () => Boolean(getToken());

  function flashSaved(label = 'Guardado') {
    if (!saveBadge) return;
    saveBadge.textContent = label;
    saveBadge.classList.remove('is-hidden');
    setTimeout(() => saveBadge.classList.add('is-hidden'), 2200);
  }

  async function apiPost(payload) {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function hydrateFromRemote() {
    try {
      const res = await fetch('/api/content');
      if (!res.ok) return;
      const remote = await res.json();
      if (Array.isArray(remote.posts)) state.posts = remote.posts;
      if (Array.isArray(remote.pillars) && remote.pillars.length) state.pillars = remote.pillars;
      saveStore({ posts: state.posts, notes: QUICK_NOTES, pillars: state.pillars });
    } catch (_) {}
  }

  function setTab(activeTab) {
    [tabPostsBtn, tabAboutBtn, tabSettingsBtn].forEach((b) => b?.classList.remove('is-active'));
    [panelPosts, panelAbout, panelSettings].forEach((p) => p?.classList.add('is-hidden'));

    if (activeTab === 'posts') {
      tabPostsBtn?.classList.add('is-active');
      panelPosts?.classList.remove('is-hidden');
    } else if (activeTab === 'about') {
      tabAboutBtn?.classList.add('is-active');
      panelAbout?.classList.remove('is-hidden');
      loadPillarForm(editingPillarKey);
    } else if (activeTab === 'settings') {
      tabSettingsBtn?.classList.add('is-active');
      panelSettings?.classList.remove('is-hidden');
    }
  }

  async function syncAuthView() {
    if (isAuthenticated()) {
      loginView.classList.add('is-hidden');
      dashboardView.classList.remove('is-hidden');
      await hydrateFromRemote();
      renderPostList();
      loadPillarForm(editingPillarKey);
      renderPreview();
    } else {
      dashboardView.classList.add('is-hidden');
      loginView.classList.remove('is-hidden');
      setTimeout(() => passcodeInput?.focus(), 40);
    }
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const entered = passcodeInput?.value || '';
    loginError?.classList.add('is-hidden');

    try {
      const { ok, status, data } = await apiPost({ action: 'login', passcode: entered });
      if (ok && data?.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token);
        passcodeInput.value = '';
        await syncAuthView();
        return;
      }
      if (status === 401) {
        if (loginError) {
          loginError.textContent = data?.error || 'Clave incorrecta. Acceso denegado.';
          loginError.classList.remove('is-hidden');
        }
        return;
      }
    } catch (_) {}

    // Offline / file:// fallback
    const localPass = localStorage.getItem(LOCAL_FALLBACK_PASS_KEY) || DEFAULT_PASSCODE;
    if (entered === localPass) {
      sessionStorage.setItem(TOKEN_KEY, 'local-session');
      passcodeInput.value = '';
      await syncAuthView();
    } else if (loginError) {
      loginError.textContent = 'Clave incorrecta. Acceso denegado.';
      loginError.classList.remove('is-hidden');
    }
  });

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem(TOKEN_KEY);
    syncAuthView();
  });

  resetBtn?.addEventListener('click', async () => {
    state = resetStore();
    try {
      await apiPost({ action: 'reset' });
    } catch (_) {}
    clearPostForm();
    loadPillarForm(editingPillarKey);
    flashSaved('Contenido restaurado');
  });

  tabPostsBtn?.addEventListener('click', () => setTab('posts'));
  tabAboutBtn?.addEventListener('click', () => setTab('about'));
  tabSettingsBtn?.addEventListener('click', () => setTab('settings'));

  function clearPostForm() {
    editingPostId = null;
    attachedMedia = null;
    titleInput.value = '';
    typeSelect.value = 'essay';
    catInput.value = 'Ensayo';
    excerptInput.value = '';
    if (editorEl) editorEl.innerHTML = '';
    if (fileStatus) fileStatus.textContent = 'o haz clic para seleccionar archivo local (WebP, PNG, MP4, WebM, PDF)';
    renderPostList();
    renderPreview();
  }

  function loadPostIntoForm(post) {
    editingPostId = post.id;
    attachedMedia = null;
    titleInput.value = post.title || '';
    typeSelect.value = post.type || 'essay';
    catInput.value = post.category || 'Ensayo';
    excerptInput.value = post.excerpt || '';
    if (editorEl) {
      if (post.bodyHtml) {
        editorEl.innerHTML = sanitizeRichHtml(post.bodyHtml);
      } else {
        const plainParagraphs = (post.sections || [])
          .flatMap((s) => s.body || [])
          .filter(Boolean);
        editorEl.innerHTML = plainParagraphs.map((par) => `<p>${escapeHtml(par)}</p>`).join('');
      }
    }
    if (fileStatus) fileStatus.textContent = 'Editando publicación existente (arrastra un archivo para reemplazar medio)';
    renderPostList();
    renderPreview();
  }

  async function persistPosts() {
    saveStore({ posts: state.posts, notes: QUICK_NOTES, pillars: state.pillars });
    try {
      const res = await apiPost({ action: 'save_posts', posts: state.posts });
      if (res.ok) {
        flashSaved('Publicado en Netlify DB');
        return;
      }
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        flashSaved('Sesión expirada: inicia sesión');
        await syncAuthView();
        return;
      }
      flashSaved(`Error servidor (${res.status})`);
      return;
    } catch (_) {}
    flashSaved('Guardado local');
  }

  function renderPostList() {
    if (!postListEl) return;
    postListEl.innerHTML = state.posts
      .map(
        (p) => `
      <div class="admin-post-item ${editingPostId === p.id ? 'is-selected' : ''}">
        <button type="button" data-edit-id="${escapeHtml(p.id)}" style="text-align:left;">
          <div class="admin-post-item__title">${escapeHtml(p.title)}</div>
        </button>
        <div class="admin-post-item__actions">
          <span>${escapeHtml(p.category)}</span>
          <button type="button" data-delete-id="${escapeHtml(p.id)}" style="color:#f87171;">Eliminar</button>
        </div>
      </div>
    `
      )
      .join('');

    postListEl.querySelectorAll('[data-edit-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = state.posts.find((p) => p.id === btn.dataset.editId);
        if (found) loadPostIntoForm(found);
      });
    });

    postListEl.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.posts = state.posts.filter((p) => p.id !== btn.dataset.deleteId);
        await persistPosts();
        if (editingPostId === btn.dataset.deleteId) clearPostForm();
        else renderPostList();
      });
    });
  }

  newPostBtn?.addEventListener('click', clearPostForm);

  function buildPostObject() {
    const existing = editingPostId ? state.posts.find((p) => p.id === editingPostId) : null;
    const title = titleInput.value.trim() || 'Artículo sin título';
    const type = typeSelect.value;
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const rawHtml = editorEl?.innerHTML || '';
    const cleanHtml = sanitizeRichHtml(rawHtml);
    const plainText = (editorEl?.innerText || '').trim();
    const paragraphs = (plainText || 'Contenido en borrador.')
      .split(/\n{1,}/)
      .map((s) => s.trim())
      .filter(Boolean);

    const post = {
      ...(existing || {}),
      id: existing ? existing.id : `${slug || 'post'}-${Date.now().toString().slice(-4)}`,
      type,
      bentoSpan: existing?.bentoSpan || (type === 'video' ? 'bento-span-5 bento-row-2' : 'bento-span-6'),
      category: catInput.value.trim() || 'Nota',
      date: existing?.date || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      readTime: type === 'video' ? 'LOOP' : type === 'pdf' ? 'PDF' : `${Math.max(1, Math.ceil(paragraphs.join(' ').split(/\s+/).length / 180))} MIN`,
      title,
      excerpt: excerptInput.value.trim() || paragraphs[0].slice(0, 140),
      bodyHtml: cleanHtml || `<p>${escapeHtml(paragraphs[0])}</p>`,
      sections: [
        {
          id: existing?.sections?.[0]?.id || 'seccion-principal',
          heading: title,
          body: paragraphs
        }
      ]
    };

    if (attachedMedia) {
      if (attachedMedia.kind === 'image') {
        post.cover = attachedMedia.url;
        post.coverAlt = title;
      } else if (attachedMedia.kind === 'video') {
        post.videoSrc = attachedMedia.url;
      } else if (attachedMedia.kind === 'pdf') {
        post.pdfUrl = attachedMedia.url;
        post.pdfMeta = {
          pages: '—',
          size: attachedMedia.sizeLabel,
          format: 'PDF',
          code: 'ADMIN'
        };
      }
    }

    return post;
  }

  function renderPreview() {
    if (!previewEl) return;
    const p = buildPostObject();
    let mediaPreview = '';
    if (attachedMedia?.kind === 'image' || p.cover) {
      const src = sanitizeUrl(attachedMedia?.kind === 'image' ? attachedMedia.url : p.cover);
      if (src) {
        mediaPreview = `<img src="${src}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;margin-bottom:1rem;border:1px solid var(--border-subtle);" />`;
      }
    } else if (attachedMedia?.kind === 'video') {
      const vSrc = sanitizeUrl(attachedMedia.url, false);
      if (vSrc) {
        mediaPreview = `<video src="${vSrc}" muted loop autoplay playsinline style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;margin-bottom:1rem;"></video>`;
      }
    } else if (attachedMedia?.kind === 'pdf') {
      mediaPreview = `<div class="meta-tag meta-tag--accent" style="margin-bottom:1rem;">PDF ADJUNTO · ${escapeHtml(attachedMedia.name)} (${escapeHtml(attachedMedia.sizeLabel)})</div>`;
    }

    previewEl.innerHTML = `
      <div class="meta-row" style="margin-bottom:0.75rem;">
        <span class="meta-tag meta-tag--accent">${escapeHtml(p.category)}</span>
        <span>${escapeHtml(p.date)}</span>
        <span>${escapeHtml(p.readTime)}</span>
      </div>
      ${mediaPreview}
      <h3 style="font-family:var(--font-display);font-size:2rem;line-height:1.1;margin-bottom:0.75rem;">${escapeHtml(p.title)}</h3>
      <p style="color:var(--text-secondary);font-size:0.95rem;margin-bottom:1rem;">${escapeHtml(p.excerpt)}</p>
      <div style="border-top:1px solid var(--border-subtle);padding-top:0.85rem;font-size:0.9rem;color:#d4d4d8;">
        ${p.bodyHtml || p.sections[0].body.map((par) => `<p style="margin-bottom:0.75rem;">${escapeHtml(par)}</p>`).join('')}
      </div>
    `;
  }

  function compressImageToDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const rawDataUrl = String(reader.result || '');
        if (file.type === 'image/svg+xml' || (file.type === 'image/png' && file.size <= 250 * 1024)) {
          resolve(rawDataUrl);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const maxW = 1200;
          const scale = img.width > maxW ? maxW / img.width : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#08080a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    const sizeLabel = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;

    let kind = 'image';
    if (file.type.startsWith('video/')) {
      kind = 'video';
      typeSelect.value = 'video';
    } else if (file.type === 'application/pdf') {
      kind = 'pdf';
      typeSelect.value = 'pdf';
    } else {
      typeSelect.value = 'essay';
    }

    if (kind === 'image') {
      if (fileStatus) fileStatus.textContent = `Optimizando ${file.name} (${sizeLabel})…`;
      const dataUrl = await compressImageToDataUrl(file);
      attachedMedia = { kind, url: dataUrl, name: file.name, sizeLabel };
      if (fileStatus) fileStatus.textContent = `Imagen lista: ${file.name} (${sizeLabel} → optimizada)`;
      renderPreview();
      return;
    }

    const url = URL.createObjectURL(file);
    attachedMedia = { kind, url, name: file.name, sizeLabel };
    if (fileStatus) fileStatus.textContent = `Cargado: ${file.name} (${sizeLabel})`;
    renderPreview();
  }

  dropzone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => handleFiles(e.target.files));
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    handleFiles(e.dataTransfer.files);
  });

  toolbarEl?.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      editorEl?.focus();
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;
      document.execCommand(cmd, false, val);
      renderPreview();
    });
  });

  [titleInput, typeSelect, catInput, excerptInput, editorEl].forEach((el) => {
    el?.addEventListener('input', renderPreview);
  });

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  publishBtn?.addEventListener('click', async () => {
    const post = buildPostObject();
    const exists = state.posts.some((p) => p.id === post.id);
    state.posts = exists ? state.posts.map((p) => (p.id === post.id ? post : p)) : [post, ...state.posts];
    editingPostId = post.id;
    renderPostList();
    await persistPosts();
  });

  exportJsonBtn?.addEventListener('click', () => {
    downloadFile('bitacora-oscura-contenido.json', JSON.stringify(state, null, 2), 'application/json');
  });

  exportHtmlBtn?.addEventListener('click', () => {
    const post = buildPostObject();
    const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>${escapeHtml(post.title)}</title></head>
<body style="background:#08080a;color:#f4f4f6;font-family:Georgia,serif;max-width:68ch;margin:4rem auto;padding:1.5rem;">
  <p style="font-family:monospace;color:#d97706;">${escapeHtml(post.category)} · ${escapeHtml(post.date)}</p>
  <h1>${escapeHtml(post.title)}</h1>
  <p><em>${escapeHtml(post.excerpt)}</em></p>
  ${post.bodyHtml || post.sections[0].body.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n  ')}
</body>
</html>`;
    downloadFile(`${post.id}.html`, html, 'text/html');
  });

  function loadPillarForm(key) {
    editingPillarKey = key;
    if (aboutPillsEl) {
      aboutPillsEl.innerHTML = state.pillars
        .map(
          (p) =>
            `<button class="btn-glass ${p.key === key ? 'is-active' : ''}" data-admin-pillar="${escapeHtml(p.key)}" type="button">${escapeHtml(p.index)} ${escapeHtml(p.label)}</button>`
        )
        .join('');
      aboutPillsEl.querySelectorAll('[data-admin-pillar]').forEach((btn) => {
        btn.addEventListener('click', () => loadPillarForm(btn.dataset.adminPillar));
      });
    }

    const pillar = state.pillars.find((p) => p.key === key) || state.pillars[0];
    if (!pillar) return;
    aboutHeadingInput.value = pillar.heading || '';
    aboutDescInput.value = pillar.description || '';
    aboutPointsInput.value = (pillar.points || []).join('\n');
    aboutNoteInput.value = pillar.note || '';
  }

  aboutSaveBtn?.addEventListener('click', async () => {
    state.pillars = state.pillars.map((p) =>
      p.key === editingPillarKey
        ? {
            ...p,
            heading: aboutHeadingInput.value.trim() || p.heading,
            description: aboutDescInput.value.trim() || p.description,
            points: aboutPointsInput.value
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
            note: aboutNoteInput.value.trim() || p.note
          }
        : p
    );
    saveStore({ posts: state.posts, notes: QUICK_NOTES, pillars: state.pillars });
    try {
      const res = await apiPost({ action: 'save_pillars', pillars: state.pillars });
      if (res.ok) {
        flashSaved('Quiénes somos en Netlify DB');
        return;
      }
    } catch (_) {}
    flashSaved('Quiénes somos guardado');
  });

  // Change Admin Password Form
  passForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const curr = currPassInput?.value || '';
    const next = newPassInput?.value || '';
    const confirm = confirmPassInput?.value || '';

    const showMsg = (text, isError = false) => {
      if (!passMsgEl) return;
      passMsgEl.textContent = text;
      passMsgEl.style.color = isError ? '#f87171' : '#4ade80';
      passMsgEl.classList.remove('is-hidden');
    };

    if (next.length < 8) {
      showMsg('La nueva clave debe tener al menos 8 caracteres.', true);
      return;
    }
    if (next !== confirm) {
      showMsg('Las nuevas claves no coinciden.', true);
      return;
    }

    try {
      const { ok, data } = await apiPost({
        action: 'change_password',
        currentPasscode: curr,
        newPasscode: next
      });
      if (ok && data?.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token);
        currPassInput.value = '';
        newPassInput.value = '';
        confirmPassInput.value = '';
        showMsg('Clave actualizada en Netlify Database.');
        flashSaved('Clave actualizada');
        return;
      }
      if (data?.error) {
        showMsg(data.error, true);
        return;
      }
    } catch (_) {}

    // Offline / file:// fallback
    const localPass = localStorage.getItem(LOCAL_FALLBACK_PASS_KEY) || DEFAULT_PASSCODE;
    if (curr !== localPass) {
      showMsg('La clave actual es incorrecta.', true);
      return;
    }
    localStorage.setItem(LOCAL_FALLBACK_PASS_KEY, next);
    currPassInput.value = '';
    newPassInput.value = '';
    confirmPassInput.value = '';
    showMsg('Clave actualizada localmente.');
    flashSaved('Clave actualizada');
  });

  syncAuthView();
}

document.addEventListener('DOMContentLoaded', initAdminPage);
})();
