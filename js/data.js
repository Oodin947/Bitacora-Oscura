/* ==========================================================================
   Editorial Content Store & Offline Media Generators
   ========================================================================== */

window.EditorialBlog = window.EditorialBlog || {};

(() => {
// Crisp editorial SVG artwork generator (zero external dependencies)
function makeEditorialArtwork({ title, accent = '#d97706', variant = 'arch' }) {
  const svg =
    variant === 'arch'
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750">
          <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#0b0b0f"/>
              <stop offset="100%" stop-color="#14141a"/>
            </linearGradient>
            <radialGradient id="glow" cx="72%" cy="28%" r="55%">
              <stop offset="0%" stop-color="${accent}" stop-opacity="0.32"/>
              <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="1200" height="750" fill="url(#bg)"/>
          <rect width="1200" height="750" fill="url(#glow)"/>
          <g stroke="rgba(255,255,255,0.09)" stroke-width="1" fill="none">
            <line x1="120" y1="0" x2="120" y2="750"/>
            <line x1="480" y1="0" x2="480" y2="750"/>
            <line x1="840" y1="0" x2="840" y2="750"/>
            <line x1="0" y1="210" x2="1200" y2="210"/>
            <line x1="0" y1="540" x2="1200" y2="540"/>
            <circle cx="840" cy="210" r="165" stroke="${accent}" stroke-opacity="0.45"/>
            <circle cx="840" cy="210" r="245" stroke="rgba(255,255,255,0.08)"/>
          </g>
          <text x="120" y="645" fill="rgba(244,244,246,0.55)" font-family="monospace" font-size="18" letter-spacing="4">${title.toUpperCase()}</text>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 675">
          <defs>
            <linearGradient id="g2" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stop-color="#09090c"/>
              <stop offset="100%" stop-color="#17171d"/>
            </linearGradient>
          </defs>
          <rect width="900" height="675" fill="url(#g2)"/>
          <g stroke="rgba(255,255,255,0.1)" fill="none">
            <rect x="110" y="95" width="680" height="485" rx="8"/>
            <rect x="180" y="155" width="240" height="365" stroke="${accent}" stroke-opacity="0.5"/>
            <line x1="460" y1="210" x2="730" y2="210"/>
            <line x1="460" y1="265" x2="690" y2="265"/>
            <line x1="460" y1="320" x2="710" y2="320"/>
          </g>
          <text x="110" y="625" fill="rgba(244,244,246,0.45)" font-family="monospace" font-size="15" letter-spacing="3">${title.toUpperCase()}</text>
        </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Minimal valid 2-page PDF generator so PDF.js works 100% offline
function createSamplePdfBlobUrl() {
  const page1 = `BT /F1 22 Tf 56 740 Td (CUADERNO TIPOGRAFICO 04) Tj 0 -30 Td /F1 11 Tf (Arquitectura Editorial en Superficies Oscuras) Tj 0 -36 Td (1. El negro puro #000000 aplana la jerarquia y fatiga la retina.) Tj 0 -20 Td (   Usar carbon #08080A con ruido fractal 3% devuelve textura fisica.) Tj 0 -28 Td (2. El vidrio sutil requiere borde superior iluminado 18% blanco) Tj 0 -20 Td (   y desenfoque saturado para separar planos sin neones.) Tj ET`;
  const page2 = `BT /F1 18 Tf 56 740 Td (ESPECIFICACION TECNICA DE GRILLA) Tj 0 -32 Td /F1 11 Tf (- Columna de lectura optima: 64ch a 68ch.) Tj 0 -22 Td (- Curva de revelacion: cubic-bezier(0.16, 1, 0.3, 1).) Tj 0 -22 Td (- Autoplay de video: umbral IntersectionObserver >= 0.60.) Tj 0 -22 Td (- Indice lateral sticky sincronizado con encabezados H2.) Tj ET`;

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj',
    '4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj',
    `5 0 obj << /Length ${page1.length} >> stream\n${page1}\nendstream endobj`,
    `6 0 obj << /Length ${page2.length} >> stream\n${page2}\nendstream endobj`,
    '7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

const INITIAL_POSTS = [];

const QUICK_NOTES = [];

const ABOUT_PILLARS = [
  {
    key: 'diseno',
    index: '01',
    label: 'Diseño',
    eyebrow: 'OFICIO VISUAL · CRITERIO',
    heading: 'Interfaces con calma, jerarquía y peso real.',
    description:
      'Diseñamos lejos de las plantillas repetitivas. Cuidamos la tipografía, el espacio en blanco y la luz sutil para que cada producto se sienta hecho por personas, para personas.',
    points: [
      'Sistemas de diseño editoriales y tipografía con intención',
      'Prototipos interactivos probados con usuarios reales',
      'Microinteracciones físicas que guían sin distraer'
    ],
    note: '“El buen diseño se nota cuando nadie tiene que adivinar qué hacer.”'
  },
  {
    key: 'codigo',
    index: '02',
    label: 'Código',
    eyebrow: 'ARQUITECTURA · RENDIMIENTO',
    heading: 'Software limpio, legible y sin fricción técnica.',
    description:
      'Escribimos código entendible hoy y mantenible dentro de dos años. Preferimos fundamentos sólidos en HTML, CSS y JavaScript antes que dependencias innecesarias.',
    points: [
      'Aplicaciones web rápidas, accesibles y resilientes',
      'Arquitecturas claras pensadas para equipos humanos',
      'Cuidado obsesivo por la latencia y los detalles de ejecución'
    ],
    note: '“Cada línea innecesaria es deuda que alguien tendrá que leer.”'
  },
  {
    key: 'capacitacion',
    index: '03',
    label: 'Capacitación',
    eyebrow: 'MENTORÍA · TALLERES',
    heading: 'Compartimos el criterio detrás de cada decisión.',
    description:
      'Creemos que el conocimiento guardado se oxida. Acompañamos a equipos y desarrolladores con talleres prácticos, revisiones honestas de código y documentación viva.',
    points: [
      'Talleres prácticos de diseño de interfaces y frontend moderno',
      'Mentorías 1 a 1 y revisión conjunta de proyectos reales',
      'Guías, cuadernos PDF y bitácoras abiertas para la comunidad'
    ],
    note: '“Enseñar obliga a entender dos veces lo que uno cree dominar.”'
  }
];

const STORAGE_KEY = 'bitacora_oscura_store_v2';

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        posts: Array.isArray(parsed.posts) ? parsed.posts : [...INITIAL_POSTS],
        notes: Array.isArray(parsed.notes) ? parsed.notes : [...QUICK_NOTES],
        pillars: Array.isArray(parsed.pillars) ? parsed.pillars : [...ABOUT_PILLARS]
      };
    }
  } catch (_) {}
  return {
    posts: [...INITIAL_POSTS],
    notes: [...QUICK_NOTES],
    pillars: [...ABOUT_PILLARS]
  };
}

function saveStore(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
}

function resetStore() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
  return {
    posts: [...INITIAL_POSTS],
    notes: [...QUICK_NOTES],
    pillars: [...ABOUT_PILLARS]
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url, allowDataImage = true) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('./') || trimmed.startsWith('/') || trimmed.startsWith('blob:') || trimmed.startsWith('procedural://')) {
    return trimmed;
  }
  if (allowDataImage && /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, 'https://example.invalid');
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch (_) {}
  return '';
}

window.EditorialBlog.data = {
  createSamplePdfBlobUrl,
  INITIAL_POSTS,
  QUICK_NOTES,
  ABOUT_PILLARS,
  loadStore,
  saveStore,
  resetStore,
  escapeHtml,
  sanitizeUrl
};
})();
