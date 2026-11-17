/* ==========================================================================
   Media Architecture — Smart Video Autoplay, Lightbox, PDF.js Dark Viewer
   ========================================================================== */

window.EditorialBlog = window.EditorialBlog || {};

(() => {
let videoObserver = null;
let cachedSamplePdfUrl = null;

function getSamplePdfUrl() {
  if (!cachedSamplePdfUrl) {
    cachedSamplePdfUrl = window.EditorialBlog.data.createSamplePdfBlobUrl();
  }
  return cachedSamplePdfUrl;
}

/**
 * Generates an animated MediaStream for demo reels when videoSrc === 'procedural://studio-reel'
 * so the <video> element behaves identically to a real MP4/WebM loop offline.
 */
function attachProceduralVideoStream(videoEl) {
  if (videoEl.dataset.streamAttached) return;
  videoEl.dataset.streamAttached = 'true';

  const canvas = document.createElement('canvas');
  canvas.width = 450;
  canvas.height = 700;
  const ctx = canvas.getContext('2d');
  let t = 0;

  function drawFrame() {
    t += 0.018;
    ctx.fillStyle = '#09090c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 45; x < canvas.width; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Animated cubic-bezier inspired curve
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const x = 45 + p * 360;
      const ease = 1 - Math.pow(1 - p, 3);
      const y = 480 - ease * 260 + Math.sin(t * 2 + p * 6) * 14;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Orbiting marker
    const markerP = (Math.sin(t) + 1) / 2;
    const mx = 45 + markerP * 360;
    const my = 480 - (1 - Math.pow(1 - markerP, 3)) * 260 + Math.sin(t * 2 + markerP * 6) * 14;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(mx, my, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(244, 244, 246, 0.55)';
    ctx.font = '12px monospace';
    ctx.fillText('CUBIC-BEZIER(0.16, 1, 0.3, 1)', 45, 620);
    ctx.fillText(`FRAME ${String(Math.floor(t * 60) % 999).padStart(3, '0')}`, 45, 642);

    if (document.body.contains(videoEl)) {
      requestAnimationFrame(drawFrame);
    }
  }

  drawFrame();

  if (typeof canvas.captureStream === 'function') {
    videoEl.srcObject = canvas.captureStream(30);
  }
}

/**
 * IntersectionObserver: auto-plays <video> when >= 60% visible, pauses otherwise.
 */
function initVideoObservers() {
  if (videoObserver) videoObserver.disconnect();

  const videos = document.querySelectorAll('video[data-smart-video]');
  if (!videos.length) return;

  videos.forEach((video) => {
    if (video.dataset.src === 'procedural://studio-reel') {
      attachProceduralVideoStream(video);
    }
  });

  videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        const badge = video.closest('.bento-card__media')?.querySelector('.video-status-pill');
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.play().catch(() => {});
          if (badge) badge.textContent = 'EN REPRODUCCIÓN';
        } else {
          video.pause();
          if (badge) badge.textContent = 'PAUSADO';
        }
      });
    },
    { threshold: [0, 0.6, 1] }
  );

  videos.forEach((v) => videoObserver.observe(v));

  // Audio mute/unmute toggles
  document.querySelectorAll('[data-audio-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = btn.closest('.bento-card__media');
      const video = wrap?.querySelector('video');
      if (!video) return;
      video.muted = !video.muted;
      btn.textContent = video.muted ? 'Audio: OFF' : 'Audio: ON';
    });
  });
}

/* ==========================================================================
   Minimalist Lightbox
   ========================================================================== */
function initLightbox() {
  const modal = document.getElementById('lightbox-modal');
  const imgEl = document.getElementById('lightbox-img');
  const captionEl = document.getElementById('lightbox-caption');
  const closeBtn = document.getElementById('lightbox-close');

  if (!modal || !imgEl) return;

  const close = () => modal.classList.remove('is-open');

  closeBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });

  window.openLightbox = (src, caption = '') => {
    const safeSrc = window.EditorialBlog.data?.sanitizeUrl(src) || '';
    if (!safeSrc) return;
    imgEl.src = safeSrc;
    imgEl.alt = caption || 'Imagen ampliada';
    if (captionEl) captionEl.textContent = caption;
    modal.classList.add('is-open');
  };
}

/* ==========================================================================
   PDF.js Dark Canvas Modal Viewer
   ========================================================================== */
function initPdfViewer() {
  const modal = document.getElementById('pdf-modal');
  const closeBtn = document.getElementById('pdf-close');
  const canvas = document.getElementById('pdf-canvas');
  const titleEl = document.getElementById('pdf-modal-title');
  const pageInfo = document.getElementById('pdf-page-info');
  const prevBtn = document.getElementById('pdf-prev');
  const nextBtn = document.getElementById('pdf-next');
  const zoomInBtn = document.getElementById('pdf-zoom-in');
  const zoomOutBtn = document.getElementById('pdf-zoom-out');
  const downloadLink = document.getElementById('pdf-download');

  if (!modal || !canvas) return;

  let pdfDoc = null;
  let currentPage = 1;
  let scale = 1.25;

  const close = () => modal.classList.remove('is-open');
  closeBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  async function renderPage(num) {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale });
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: ctx, viewport }).promise;
    if (pageInfo) pageInfo.textContent = `Pág. ${num} / ${pdfDoc.numPages} · ${Math.round(scale * 100)}%`;
  }

  prevBtn?.addEventListener('click', () => {
    if (pdfDoc && currentPage > 1) {
      currentPage--;
      renderPage(currentPage);
    }
  });

  nextBtn?.addEventListener('click', () => {
    if (pdfDoc && currentPage < pdfDoc.numPages) {
      currentPage++;
      renderPage(currentPage);
    }
  });

  zoomInBtn?.addEventListener('click', () => {
    if (pdfDoc && scale < 2.5) {
      scale += 0.2;
      renderPage(currentPage);
    }
  });

  zoomOutBtn?.addEventListener('click', () => {
    if (pdfDoc && scale > 0.7) {
      scale -= 0.2;
      renderPage(currentPage);
    }
  });

  window.openPdfModal = async (url, title = 'Documento PDF') => {
    const safeUrl = url ? window.EditorialBlog.data?.sanitizeUrl(url, false) : '';
    const resolvedUrl = safeUrl || getSamplePdfUrl();
    if (titleEl) titleEl.textContent = title;
    if (downloadLink) {
      downloadLink.href = resolvedUrl;
      downloadLink.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
    }
    modal.classList.add('is-open');

    if (window.pdfjsLib) {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfDoc = await window.pdfjsLib.getDocument(resolvedUrl).promise;
        currentPage = 1;
        scale = 1.25;
        await renderPage(currentPage);
      } catch (err) {
        if (pageInfo) pageInfo.textContent = 'Error al renderizar PDF (usa Descargar)';
      }
    } else {
      if (pageInfo) pageInfo.textContent = 'PDF.js no disponible offline (usa Descargar)';
    }
  };
}

window.EditorialBlog.media = {
  getSamplePdfUrl,
  initVideoObservers,
  initLightbox,
  initPdfViewer
};
})();
