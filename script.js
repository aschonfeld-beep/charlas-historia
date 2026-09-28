/**
 * Frontend (Grupo B). Uso: index.html?config=ejemplo.cfg
 *
 * Convenciones (misma carpeta que index.html):
 *  - config JSON: "escenario" (imagen 640x480) y "areas" (array de textos <area ...>)
 *  - cara del personaje: nombre en minúsculas, sin tildes, con _  ->  leonardo_da_vinci.png (180x240)
 *  - logo de la charla: logo.png (si no existe, se usa uno por defecto)
 *  - API: URL de abajo. Con Vercel (mismo dominio) alcanza con 'api'.
 *    Si el frontend está en GitHub Pages, poné la URL completa, ej: 'https://mi-api.vercel.app/api'
 *    (también se puede pisar con "api" dentro del config).
 */
const API_URL = 'api';

const $ = id => document.getElementById(id);
const accion = $('accion'), respuesta = $('respuesta'), form = $('form'),
      pregunta = $('pregunta'), enviar = $('enviar'), cara = $('cara'),
      logo = $('logo'), fondo = $('fondo'), mapa = $('mapa');

let actual = null, escritura = null, apiUrl = API_URL;

const LOGO_SVG = `<svg viewBox="0 0 180 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo de la charla">
  <rect width="180" height="240" fill="#1b1530"/>
  <path d="M40 70h100v70H92l-24 24v-24H40z" fill="#ffd166"/>
  <rect x="58" y="88" width="64" height="8" fill="#1b1530"/>
  <rect x="58" y="106" width="44" height="8" fill="#1b1530"/>
  <text x="90" y="200" text-anchor="middle" fill="#5fd3c8" font-family="Courier New,monospace" font-size="17" font-weight="bold">CHARLAS CON</text>
  <text x="90" y="220" text-anchor="middle" fill="#5fd3c8" font-family="Courier New,monospace" font-size="17" font-weight="bold">LA HISTORIA</text>
</svg>`;

function slug(s){
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function setAccion(t, sobre){ accion.textContent = t; accion.classList.toggle('sobre', !!sobre); }
function textoBase(){ return actual ? 'Hablando con ' + actual.nombre : '\u00a0'; }
function fallo(msg){ setAccion('\u00a0'); respuesta.textContent = msg; }

/* ---------- carga del config ---------- */
async function cargar(){
  const nombre = new URLSearchParams(location.search).get('config') || '';
  if (!/^[\w\-]+\.(cfg|json)$/i.test(nombre)) return fallo('Falta o es inválido el parámetro config (ej: ?config=ejemplo.cfg).');

  let cfg;
  try {
    const r = await fetch(nombre, {cache: 'no-cache'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    cfg = JSON.parse(await r.text());
  } catch (e) {
    return fallo('No se pudo leer ' + nombre + ': ' + e.message);
  }

  const escenario = String(cfg.escenario || '').split('/').pop();
  if (!escenario) return fallo('El config no tiene "escenario".');
  if (typeof cfg.api === 'string') apiUrl = cfg.api;
  fondo.src = escenario;

  const lista = cfg.areas || cfg.areas_personajes || cfg.areasPersonajes || cfg['áreas'] || [];
  const personajes = [];
  for (const html of lista) {
    if (typeof html !== 'string') continue;
    const c = html.match(/coords\s*=\s*"([\d\s,]+)"/i);
    const a = html.match(/alt\s*=\s*"([^"]*)"/i);
    if (!c || !a) continue;
    const t = document.createElement('textarea');           // decodifica &amp; etc.
    t.innerHTML = a[1];
    const nombreP = t.value.trim();
    if (!nombreP) continue;
    personajes.push({nombre: nombreP, coords: c[1].replace(/\s+/g, ''), cara: slug(nombreP) + '.png'});
  }

  fondo.useMap = '#personajes';
  for (const p of personajes) {
    const el = document.createElement('area');
    el.shape = 'rect';
    el.coords = p.coords;
    el.href = '#';
    el.alt = p.nombre;
    el.addEventListener('mouseover', () => setAccion('Hablar con ' + p.nombre, true));
    el.addEventListener('mouseout',  () => setAccion(textoBase(), false));
    el.addEventListener('click', e => { e.preventDefault(); iniciar(p); });
    mapa.appendChild(el);
  }

  // logo
  const l = new Image(180, 240);
  l.alt = 'Logo de la charla';
  l.onerror = () => { logo.innerHTML = LOGO_SVG; };
  l.onload  = () => { logo.innerHTML = ''; logo.appendChild(l); };
  l.src = 'logo.png';
}

/* ---------- conversación ---------- */
function iniciar(p){
  actual = p;
  cara.innerHTML = '';
  const img = new Image(180, 240);
  img.alt = p.nombre;
  img.onerror = () => { cara.textContent = ''; const d = document.createElement('div'); d.className = 'vacio'; d.textContent = p.nombre; cara.appendChild(d); };
  img.src = p.cara;
  cara.appendChild(img);
  setAccion(textoBase(), false);
  respuesta.textContent = '';
  form.classList.add('activo');
  pregunta.value = '';
  pregunta.focus();
}

function escribir(texto){
  clearInterval(escritura);
  respuesta.textContent = '';
  let i = 0;
  escritura = setInterval(() => {
    respuesta.textContent = texto.slice(0, ++i);
    if (i >= texto.length) clearInterval(escritura);
  }, 18);
}

async function preguntar(){
  const q = pregunta.value.trim();
  if (!q || !actual) return;
  const prompt =
    'Respondé en forma muy breve (máximo dos oraciones), en primera persona y en el idioma de la pregunta, ' +
    'como si fueras el personaje histórico ' + actual.nombre + ', con su forma de hablar y su época. ' +
    'No salgas del personaje. Pregunta: ' + q;
  pregunta.disabled = enviar.disabled = true;
  clearInterval(escritura);
  respuesta.textContent = '...';
  try {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({prompt})
    });
    const t = await r.text();
    if (!r.ok) throw new Error(t);
    escribir(t.trim());
    pregunta.value = '';
  } catch (e) {
    respuesta.textContent = 'No se pudo obtener respuesta: ' + e.message;
  } finally {
    pregunta.disabled = enviar.disabled = false;
    pregunta.focus();
  }
}
enviar.addEventListener('click', preguntar);
pregunta.addEventListener('keydown', e => { if (e.key === 'Enter') preguntar(); });

cargar();
