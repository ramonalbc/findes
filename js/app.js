import { SUPABASE_URL, SUPABASE_KEY, APP_VERSION, MIN_YEAR, YEARS_AHEAD, VAPID_PUBLIC_KEY } from './config.js';
import { HOLIDAYS, HOLIDAY_STATUS } from './holidays.js';
import {
  MONTHS, MONTHS_SHORT, DOW_SHORT, DOW_LETTER, DOW_LONG,
  addDays, dow, dayNum, monthIdx, diffDays, todayIso,
  weekendsOfYear, rangeLabel, overlaps, fridayFor,
} from './dates.js';

// ------------------------------------------------------------------ catálogos

const CATS = {
  golf:      { label: 'Golf',      color: '#2E7D4F' },
  boda:      { label: 'Boda',      color: '#7B4FC9' },
  cumple:    { label: 'Cumple',    color: '#D9622B' },
  viaje:     { label: 'Viaje',     color: '#1F7FB8' },
  familia:   { label: 'Familia',   color: '#0F8C82' },
  concierto: { label: 'Concierto', color: '#C2417A' },
  comida:    { label: 'Comida',    color: '#A87A00' },
  trabajo:   { label: 'Trabajo',   color: '#59606B' },
  otro:      { label: 'Otro',      color: '#8A8F98' },
};

const WHO = {
  ramon: { label: 'Ramón',   short: 'R',   bg: '#1F4FD1', fg: '#FFFFFF' },
  irene: { label: 'Irene',   short: 'I',   bg: '#E8A0B4', fg: '#15171C' },
  ambos: { label: 'Los dos', short: 'R+I', bg: '#7A1F2B', fg: '#FFFFFF' },
};

// ------------------------------------------------------------------ estado

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'findes-auth' },
});

const S = {
  session: null,
  me: null,          // fila de members del usuario actual
  plans: [],
  notes: {},         // viernes → texto
  extras: {},        // fecha → etiqueta
  loaded: false,
  error: null,
  listFilter: 'todos',
  search: '',
  searchOpen: false,
  draft: null,       // plan que se está editando
  draftKey: null,
  busy: false,
  push: null,        // estado de los avisos en este dispositivo
};

const app = document.getElementById('app');

// ------------------------------------------------------------------ utilidades

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function offInfo(d) {
  if (HOLIDAYS[d]) return { kind: 'holiday', label: HOLIDAYS[d] };
  const ex = S.extras[d];
  if (ex) return ex.kind === 'festivo'
    ? { kind: 'holiday', label: ex.label || 'Festivo', custom: true }
    : { kind: 'extra', label: ex.label || 'Puente' };
  return null;
}

const maxYear = () => new Date().getFullYear() + YEARS_AHEAD;
const clampYear = (y) => Math.min(Math.max(y, MIN_YEAR), maxYear());

function yearArrows(base, year, showYear = true) {
  const prev = year > MIN_YEAR
    ? `<a href="#/${base}/${year - 1}" aria-label="Año anterior">${icon('back', 18)}</a>`
    : `<span class="off" aria-hidden="true">${icon('back', 18)}</span>`;
  const next = year < maxYear()
    ? `<a href="#/${base}/${year + 1}" aria-label="Año siguiente">${icon('next', 18)}</a>`
    : `<span class="off" aria-hidden="true">${icon('next', 18)}</span>`;
  return `<div class="yearsel">${prev}${showYear ? `<span>${year}</span>` : ''}${next}</div>`;
}

function holidayBanner(year) {
  const st = HOLIDAY_STATUS[year];
  if (!st || st === 'completo') return '';
  return `<a class="banner pad-x" href="#/festivos/${year}">${esc(st)}. Se añadirán solos cuando se publiquen; mientras, puedes declarar festivos a mano ›</a>`;
}

const yearCache = new Map();
function weekends(year) {
  const key = year + '|' + Object.entries(S.extras).map(([d, x]) => d + x.kind).join(',');
  if (!yearCache.has(key)) yearCache.set(key, weekendsOfYear(year, offInfo));
  return yearCache.get(key);
}

function weekendById(friday) {
  const y = Number(addDays(friday, 2).slice(0, 4));
  return weekends(y).find((w) => w.id === friday) || null;
}

function weekendContaining(d) {
  const y = Number(d.slice(0, 4));
  for (const yy of [y, y + 1, y - 1]) {
    const w = weekends(yy).find((x) => x.start <= d && d <= x.end);
    if (w) return w;
  }
  return weekendById(fridayFor(d));
}

function plansIn(from, to) {
  return S.plans
    .filter((p) => overlaps(p.date_from, p.date_to, from, to))
    .sort((a, b) => (a.date_from + (a.start_time || '')).localeCompare(b.date_from + (b.start_time || '')));
}

function weekendStatus(w) {
  const ps = plansIn(w.start, w.end);
  if (!ps.length) return 'L';
  const who = new Set(ps.map((p) => p.who));
  if (who.has('ambos')) return 'A';
  if (who.has('ramon') && who.has('irene')) return 'M';
  return who.has('ramon') ? 'R' : 'I';
}

const time = (t) => (t ? t.slice(0, 5) : '');

function planWhen(p, w) {
  const t = p.start_time ? ' ' + time(p.start_time) : '';
  if (p.date_from === p.date_to) return DOW_SHORT[dow(p.date_from)] + t;
  if (w && p.date_from <= w.start && p.date_to >= w.end) {
    return p.date_from < w.start || p.date_to > w.end ? 'Varios findes' : 'Todo el finde';
  }
  return `${DOW_SHORT[dow(p.date_from)]}–${DOW_SHORT[dow(p.date_to)]}${t}`;
}

function longRange(w) {
  if (monthIdx(w.start) === monthIdx(w.end)) return `${rangeLabel(w.start, w.end)} ${MONTHS[monthIdx(w.end)]}`;
  return `${dayNum(w.start)} ${MONTHS_SHORT[monthIdx(w.start)].toLowerCase()} – ${dayNum(w.end)} ${MONTHS_SHORT[monthIdx(w.end)].toLowerCase()}`;
}

const badge = (who, size = '') => {
  const c = WHO[who] || WHO.ambos;
  return `<span class="badge ${size}" style="background:${c.bg};color:${c.fg}">${size === 'long' ? c.label : c.short}</span>`;
};
const dot = (cat) => `<span class="dot" style="background:${(CATS[cat] || CATS.otro).color}"></span>`;

const ICON = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  note: '<path d="M4 4h16v12H8l-4 4z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const icon = (name, size = 22) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

function tabbar(active) {
  const y = new Date().getFullYear();
  const tabs = [
    ['inicio', 'Inicio', '#/', 'home'],
    ['findes', 'Findes', `#/findes/${y}`, 'list'],
    ['ano', 'Año', `#/ano/${y}`, 'grid'],
    ['ajustes', 'Ajustes', '#/ajustes', 'user'],
  ];
  return `<nav class="tabbar">${tabs.map(([k, l, h, i]) =>
    `<a href="${h}" class="${k === active ? 'on' : ''}">${icon(i, 24)}<span>${l}</span></a>`).join('')}</nav>`;
}

const fab = (href) => `<a class="fab" href="${href}" aria-label="Añadir plan">${icon('plus', 26)}</a>`;

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// ------------------------------------------------------------------ datos

async function loadAll() {
  const [m, p, n, e] = await Promise.all([
    sb.from('members').select('*'),
    sb.from('plans').select('*').order('date_from'),
    sb.from('week_notes').select('*'),
    sb.from('extra_days').select('*'),
  ]);
  const err = m.error || p.error || n.error || e.error;
  if (err) throw err;
  const email = (S.session?.user?.email || '').toLowerCase();
  S.me = m.data.find((x) => x.email === email) || null;
  S.plans = p.data;
  S.notes = Object.fromEntries(n.data.map((x) => [x.weekend, x.text]));
  S.extras = Object.fromEntries(e.data.map((x) => [x.day, { label: x.label, kind: x.kind || 'puente' }]));
  yearCache.clear();
  S.loaded = true;
}

let channel = null;
function subscribe() {
  if (channel) return;
  channel = sb.channel('findes-db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'week_notes' }, onRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'extra_days' }, onRemoteChange)
    .subscribe();
}
let remoteTimer = null;
function onRemoteChange() {
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(async () => {
    try { await loadAll(); softRender(); } catch (_) { /* se reintenta en el siguiente cambio */ }
  }, 300);
}

// Re-pinta salvo que el usuario esté escribiendo, para no quitarle el foco.
function softRender() {
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
  if (route().name === 'plan' || route().name === 'nuevo') return;
  render();
}

// ------------------------------------------------------------------ rutas

function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [name = 'inicio', a, b] = parts;
  return { name, a, b };
}

function render() {
  if (!S.session) { app.innerHTML = viewLogin(); return; }
  if (S.error) { app.innerHTML = viewError(); return; }
  if (!S.loaded) { app.innerHTML = '<div class="loading">Cargando…</div>'; return; }
  if (!S.me) { app.innerHTML = viewNoAccess(); return; }
  const r = route();
  const y = clampYear(Number(r.a) || new Date().getFullYear());
  let html;
  switch (r.name) {
    case 'findes': html = viewList(y); break;
    case 'ano': html = viewYear(y); break;
    case 'festivos': html = viewHolidays(y); break;
    case 'finde': html = viewWeekend(r.a); break;
    case 'nuevo': html = viewEditor({ friday: r.a, day: r.b }); break;
    case 'plan': html = viewEditor({ id: r.a }); break;
    case 'ajustes': html = viewSettings(); break;
    default: html = viewHome();
  }
  app.innerHTML = html;
}

// ------------------------------------------------------------------ vistas

function viewLogin() {
  return `
  <main class="screen login">
    <div class="login-box">
      <div class="logo">${icon('grid', 34)}</div>
      <h1>Findes</h1>
      <p class="muted">Los planes de Ramón e Irene</p>
      <form id="login-form" class="stack">
        <label class="field"><span>Email</span>
          <input name="email" type="email" autocomplete="username" required inputmode="email"></label>
        <label class="field"><span>Contraseña</span>
          <input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Entrando…' : 'Entrar'}</button>
        <p class="error" id="login-error"></p>
      </form>
    </div>
  </main>`;
}

function viewError() {
  return `<main class="screen pad"><h1>Algo ha fallado</h1>
    <p class="muted">${esc(S.error)}</p>
    <button class="btn primary" data-action="retry">Reintentar</button></main>`;
}

function viewNoAccess() {
  return `<main class="screen pad"><h1>Sin acceso</h1>
    <p class="muted">Este usuario no está autorizado en Findes.</p>
    <button class="btn" data-action="logout">Cerrar sesión</button></main>`;
}

function viewHome() {
  const t = todayIso();
  const y = Number(t.slice(0, 4));
  const all = [...weekends(y), ...weekends(y + 1)];
  const idx = all.findIndex((w) => w.end >= t);
  const w = all[idx];
  const after = all[idx + 1];
  const now = t >= w.start;
  const days = diffDays(t, w.start);
  const when = now ? 'ESTE FINDE' : `PRÓXIMO FINDE · ${days === 1 ? 'MAÑANA' : `EN ${days} DÍAS`}`;
  const ps = plansIn(w.start, w.end);
  const d = new Date();
  const todayLabel = `${DOW_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`.toUpperCase();

  const dayCells = w.days.map((day) => {
    const p = ps.find((x) => x.date_from <= day.date && day.date <= x.date_to);
    return `<div class="hday ${p ? 'busy' : ''}">
      <span class="hday-l">${DOW_SHORT[day.dow].toUpperCase()} ${dayNum(day.date)}</span>
      <span class="hday-p">${p ? esc(p.title) : (day.kind !== 'base' ? esc(day.label) : 'Libre')}</span>
    </div>`;
  }).join('');

  const afterPs = after ? plansIn(after.start, after.end) : [];
  return `
  <main class="screen">
    <header class="top">
      <span class="eyebrow">${todayLabel}</span>
      <h1>Findes</h1>
    </header>
    <section class="pad stack">
      <a class="hero" href="#/finde/${w.id}">
        <span class="pill">${when}</span>
        <div><div class="hero-n">${rangeLabel(w.start, w.end)}</div>
        <div class="hero-m">${MONTHS[w.month]}${w.extended ? ` · ${w.days.length} días` : ''}</div></div>
        <div class="hdays" style="grid-template-columns:repeat(${w.days.length},minmax(0,1fr))">${dayCells}</div>
        ${ps.length ? ps.map((p) => `<div class="hplan">
            <span class="hcat">${esc((CATS[p.category] || CATS.otro).label)}</span>
            <span class="grow">${esc(p.title)}</span>${badge(p.who)}</div>`).join('')
          : '<div class="hplan"><span class="grow">Sin planes todavía</span></div>'}
      </a>
      ${after ? `<a class="after" href="#/finde/${after.id}">
        <span class="after-l">DESPUÉS · ${rangeLabel(after.start, after.end)}</span>
        <span class="grow ellipsis">${afterPs.length ? afterPs.map((p) => esc(p.title)).join(' · ') : 'Libre'}</span>
        ${icon('next', 18)}</a>` : ''}
    </section>
    ${fab(`#/nuevo/${w.id}`)}
    ${tabbar('inicio')}
  </main>`;
}

function weekendCard(w, isNext) {
  const ps = plansIn(w.start, w.end);
  const extraChips = w.extended
    ? `<div class="chips">${w.days.map((d) => d.kind === 'base'
        ? `<span class="chip">${DOW_LETTER[d.dow]} ${dayNum(d.date)}</span>`
        : `<span class="chip ${d.kind}">${DOW_LETTER[d.dow]} ${dayNum(d.date)} · ${d.kind === 'extra' ? 'puente' : 'festivo'}</span>`).join('')}</div>`
    : '';
  const hol = !w.extended ? w.days.filter((d) => d.kind === 'holiday') : [];
  const holChips = hol.length ? `<div class="chips">${hol.map((d) =>
    `<span class="chip holiday">${DOW_LETTER[d.dow]} ${dayNum(d.date)} · ${esc(d.label)}</span>`).join('')}</div>` : '';
  const body = ps.length
    ? ps.map((p) => `<div class="prow">${p.status === 'pendiente' ? '<span class="dot pend"></span>' : dot(p.category)}
        <span class="grow">${esc(p.title)}</span>
        ${p.status === 'pendiente' ? '<span class="tag-pend">PENDIENTE</span>' : `<span class="muted sm">${planWhen(p, w)}</span>`}
        ${badge(p.who)}</div>`).join('')
    : '<span class="muted">Libre · toca para añadir un plan</span>';
  return `<a class="card ${ps.length ? '' : 'free'} ${isNext ? 'next' : ''}" href="#/finde/${w.id}">
    <div class="datecol"><span class="dn">${rangeLabel(w.start, w.end)}</span>
      <span class="dm">${MONTHS_SHORT[w.month]}</span>
      ${w.extended ? `<span class="dtag">${w.days.length} DÍAS</span>` : ''}
      ${isNext ? '<span class="dnext">PRÓXIMO</span>' : ''}</div>
    <div class="cbody">${extraChips}${holChips}${body}</div>
  </a>`;
}

function viewList(year) {
  const t = todayIso();
  const ws = weekends(year);
  const nextId = [...weekends(new Date().getFullYear()), ...weekends(new Date().getFullYear() + 1)]
    .find((w) => w.end >= t)?.id;
  const free = ws.filter((w) => !plansIn(w.start, w.end).length);
  const pend = ws.filter((w) => plansIn(w.start, w.end).some((p) => p.status === 'pendiente'));
  const shown = S.listFilter === 'libres' ? free : S.listFilter === 'pendientes' ? pend : ws;

  let body = '';
  if (S.searchOpen && S.search.trim()) {
    const q = S.search.trim().toLowerCase();
    const hits = S.plans.filter((p) => (p.title + ' ' + (p.location || '') + ' ' + (p.notes || '')).toLowerCase().includes(q))
      .sort((a, b) => b.date_from.localeCompare(a.date_from));
    body = hits.length ? hits.map((p) => {
      const w = weekendContaining(p.date_from);
      return `<a class="card" href="#/finde/${w.id}">
        <div class="datecol"><span class="dn">${rangeLabel(w.start, w.end)}</span>
        <span class="dm">${MONTHS_SHORT[w.month]} ${w.year}</span></div>
        <div class="cbody"><div class="prow">${dot(p.category)}<span class="grow">${esc(p.title)}</span>${badge(p.who)}</div></div></a>`;
    }).join('') : '<p class="muted pad">Nada encontrado.</p>';
  } else {
    let lastMonth = -1;
    for (const w of shown) {
      if (w.month !== lastMonth) { body += `<h2 class="month">${MONTHS[w.month][0].toUpperCase() + MONTHS[w.month].slice(1)}</h2>`; lastMonth = w.month; }
      body += weekendCard(w, w.id === nextId);
    }
    if (!shown.length) body = '<p class="muted pad">No hay findes con este filtro.</p>';
  }

  return `
  <main class="screen">
    <header class="top row-between">
      <div><span class="eyebrow">RAMÓN E IRENE</span><h1>Findes</h1></div>
      ${yearArrows('findes', year)}
    </header>
    ${holidayBanner(year)}
    <div class="filters">
      <button class="fchip ${S.listFilter === 'todos' ? 'on' : ''}" data-action="filter" data-v="todos">Todos</button>
      <button class="fchip ${S.listFilter === 'libres' ? 'on' : ''}" data-action="filter" data-v="libres">Libres · ${free.length}</button>
      <button class="fchip ${S.listFilter === 'pendientes' ? 'on' : ''}" data-action="filter" data-v="pendientes">Pendientes</button>
      <button class="fchip icon ${S.searchOpen ? 'on' : ''}" data-action="search" aria-label="Buscar">${icon('search', 16)}</button>
    </div>
    ${S.searchOpen ? `<div class="pad"><input id="search" class="search" type="search" placeholder="Buscar en todos los años…" value="${esc(S.search)}"></div>` : ''}
    <section class="pad stack list">${body}</section>
    ${fab(`#/nuevo/${nextId || ws[0].id}`)}
    ${tabbar('findes')}
  </main>`;
}

function viewYear(year) {
  const ws = weekends(year);
  const t = todayIso();
  const cy = new Date().getFullYear();
  const nextId = [...weekends(cy), ...weekends(cy + 1)].find((w) => w.end >= t)?.id;
  const counts = { A: 0, R: 0, I: 0, M: 0, L: 0 };
  const byMonth = Array.from({ length: 12 }, () => []);
  for (const w of ws) { const s = weekendStatus(w); counts[s]++; byMonth[w.month].push([w, s]); }
  const cell = (w, s) => `<a href="#/finde/${w.id}" class="ycell s${s} ${w.id === nextId ? 'ring' : ''}" aria-label="${longRange(w)}">
      ${s === 'M' ? '<i class="h1"></i><i class="h2"></i>' : ''}<span>${rangeLabel(w.start, w.end)}</span></a>`;
  const leg = (s, label) => `<div class="leg"><span class="sw s${s}">${s === 'M' ? '<i class="h1"></i><i class="h2"></i>' : ''}</span>
      <span>${label}</span><b>${counts[s]}</b></div>`;
  return `
  <main class="screen">
    <header class="top row-between">
      <h1>${year}</h1>
      ${yearArrows('ano', year, false)}
    </header>
    ${holidayBanner(year)}
    <section class="pad legend">${leg('A', 'Los dos')}${leg('R', 'Ramón')}${leg('I', 'Irene')}${leg('M', 'Cada uno lo suyo')}${leg('L', 'Libre')}</section>
    <section class="pad ygrid">
      ${byMonth.map((arr, m) => `<div class="yrow"><span class="ym ${m === new Date().getMonth() && year === new Date().getFullYear() ? 'cur' : ''}">${MONTHS_SHORT[m][0] + MONTHS_SHORT[m].slice(1).toLowerCase()}</span>
        <div class="ycells">${arr.map(([w, s]) => cell(w, s)).join('')}${'<span></span>'.repeat(5 - arr.length)}</div></div>`).join('')}
    </section>
    ${tabbar('ano')}
  </main>`;
}

function planCard(p, w) {
  const c = CATS[p.category] || CATS.otro;
  const bits = [];
  if (p.start_time) bits.push(time(p.start_time) + (p.end_time ? ' – ' + time(p.end_time) : ''));
  if (p.date_from !== p.date_to) bits.push(planWhen(p, w));
  bits.push(c.label);
  if (p.location) bits.push(esc(p.location));
  return `<a class="pcard" href="#/plan/${p.id}">
    <span class="bar" style="background:${c.color}"></span>
    <div class="grow"><div class="ptitle">${esc(p.title)}${p.status === 'pendiente' ? ' <span class="tag-pend">PENDIENTE</span>' : ''}</div>
    <div class="muted sm">${bits.join(' · ')}</div>
    ${p.notes ? `<div class="pnotes">${esc(p.notes)}</div>` : ''}</div>
    ${badge(p.who, 'long')}
  </a>`;
}

function viewWeekend(friday) {
  const w = weekendById(friday);
  if (!w) return `<main class="screen pad"><p>Finde no encontrado.</p><a href="#/">Volver</a></main>`;
  const ps = plansIn(w.start, w.end);
  const multi = ps.filter((p) => p.date_from !== p.date_to);
  const single = ps.filter((p) => p.date_from === p.date_to);

  const before = addDays(w.start, -1);
  const afterD = addDays(w.end, 1);
  const extrasHere = w.days.filter((d) => d.kind === 'extra');

  const sections = w.days.map((d) => {
    const dp = single.filter((p) => p.date_from === d.date);
    const cover = multi.filter((p) => p.date_from <= d.date && d.date <= p.date_to);
    const covered = cover.length
      ? `<a class="covered" href="#/nuevo/${w.id}/${d.date}">${cover.map((p) => esc(p.title)).join(' · ')}<span class="grow"></span>${icon('plus', 16)}</a>`
      : '';
    return `<div class="dsec">
      <span class="dlabel">${DOW_LONG[d.dow].toUpperCase()} ${dayNum(d.date)}${d.kind !== 'base' ? ` · <span class="hl">${esc(d.label)}</span>` : ''}</span>
      ${dp.length ? `<div class="stack-s">${dp.map((p) => planCard(p, w)).join('')}</div>`
        : covered || `<a class="empty" href="#/nuevo/${w.id}/${d.date}">${icon('plus', 18)} Sin planes · añadir</a>`}
    </div>`;
  }).join('');

  return `
  <main class="screen">
    <div class="nav">
      <a href="#/findes/${w.year}">${icon('back')} Findes</a>
    </div>
    <header class="top tight">
      <span class="eyebrow">${MONTHS[w.month].toUpperCase()} ${w.year}</span>
      <h1>${longRange(w)}</h1>
    </header>
    <section class="pad stack">
      ${multi.length ? `<div class="dsec"><span class="dlabel">VARIOS DÍAS</span><div class="stack-s">${multi.map((p) => planCard(p, w)).join('')}</div></div>` : ''}
      ${sections}
      <div class="dsec">
        <span class="dlabel">ENTRE SEMANA (ANTES DEL FINDE)</span>
        <div class="note">${icon('note', 18)}
          <textarea id="week-note" data-weekend="${w.id}" rows="2" placeholder="Algo que apuntar de la semana…">${esc(S.notes[w.id] || '')}</textarea>
        </div>
      </div>
      <div class="dsec">
        <span class="dlabel">ALARGAR EL FINDE</span>
        <div class="chips">
          ${!offInfo(before) ? `<button class="fchip" data-action="add-extra" data-day="${before}">+ ${DOW_LONG[dow(before)]} ${dayNum(before)} como puente</button>` : ''}
          ${!offInfo(afterD) ? `<button class="fchip" data-action="add-extra" data-day="${afterD}">+ ${DOW_LONG[dow(afterD)]} ${dayNum(afterD)} como puente</button>` : ''}
          ${extrasHere.map((d) => `<button class="fchip on" data-action="del-extra" data-day="${d.date}">Quitar puente ${DOW_SHORT[d.dow].toLowerCase()} ${dayNum(d.date)}</button>`).join('')}
        </div>
      </div>
    </section>
    <div class="bottom-cta"><a class="btn primary" href="#/nuevo/${w.id}">${icon('plus', 20)} Añadir plan</a></div>
  </main>`;
}

// ---- editor de plan

function startDraft({ id, friday, day }) {
  const key = id ? 'id:' + id : `new:${friday}:${day || ''}`;
  if (S.draftKey === key && S.draft) return;
  S.draftKey = key;
  if (id) {
    const p = S.plans.find((x) => x.id === id);
    if (!p) { S.draft = null; return; }
    const w = weekendContaining(p.date_from);
    S.draft = { ...p, start_time: time(p.start_time), end_time: time(p.end_time), friday: w.id,
      multi: p.date_from < w.start || p.date_to > w.end, timed: !!p.start_time };
  } else {
    const w = weekendById(friday) || weekendContaining(todayIso());
    const d = day || null;
    S.draft = {
      id: null, title: '', category: 'otro', who: S.me?.person === 'irene' ? 'irene' : 'ramon',
      date_from: d || w.start, date_to: d || w.end, start_time: '', end_time: '',
      location: '', status: 'confirmado', notes: '', friday: w.id, multi: false, timed: false,
    };
    if (!d) { // por defecto: viernes a domingo
      S.draft.date_from = w.days.find((x) => x.base).date;
      S.draft.date_to = w.sunday;
    }
  }
}

function viewEditor(args) {
  startDraft(args);
  const D = S.draft;
  if (!D) return `<main class="screen pad"><p>Plan no encontrado.</p><a href="#/">Volver</a></main>`;
  const w = weekendById(D.friday);
  const back = `#/finde/${w.id}`;
  const dayBtns = w.days.map((d) => {
    const on = D.date_from <= d.date && d.date <= D.date_to;
    return `<button type="button" class="dbtn ${on ? 'on' : ''}" data-action="day" data-day="${d.date}">
      <span>${DOW_SHORT[d.dow].toUpperCase()}</span><b>${dayNum(d.date)}</b></button>`;
  }).join('');

  return `
  <main class="screen editor">
    <div class="nav between">
      <a href="${back}">Cancelar</a>
      <b>${D.id ? 'Editar plan' : 'Nuevo plan'}</b>
      <button class="link strong" data-action="save" ${S.busy ? 'disabled' : ''}>Guardar</button>
    </div>
    <section class="pad stack">
      <label class="field"><span class="lab">PLAN</span>
        <input id="f-title" data-field="title" type="text" value="${esc(D.title)}" placeholder="¿Qué plan es?" autocomplete="off"></label>
      <span class="muted sm">Finde ${longRange(w)}</span>

      <div class="field"><span class="lab">CATEGORÍA</span>
        <div class="chips">${Object.entries(CATS).map(([k, c]) => `<button type="button" class="cchip ${D.category === k ? 'on' : ''}"
          style="${D.category === k ? `border-color:${c.color};background:${c.color}1A` : ''}" data-action="cat" data-v="${k}">
          <span class="dot" style="background:${c.color}"></span>${c.label}</button>`).join('')}</div></div>

      <div class="field"><span class="lab">¿QUIÉN?</span>
        <div class="seg">${Object.entries(WHO).map(([k, c]) => `<button type="button" class="${D.who === k ? 'on' : ''}" data-action="who" data-v="${k}"
          ${D.who === k ? `style="background:${c.bg};color:${c.fg}"` : ''}>${c.label}</button>`).join('')}</div></div>

      <div class="field"><span class="lab">DÍAS</span>
        ${D.multi ? `<div class="group">
            <label class="grow-row"><span>Desde</span><input type="date" data-field="date_from" value="${D.date_from}"></label>
            <label class="grow-row"><span>Hasta</span><input type="date" data-field="date_to" value="${D.date_to}"></label></div>`
          : `<div class="dbtns" style="grid-template-columns:repeat(${w.days.length},minmax(0,1fr))">${dayBtns}</div>`}
        <button type="button" class="link sm" data-action="multi">${D.multi ? 'Solo este finde' : 'Dura más de un finde (vacaciones, viaje…)'}</button>
      </div>

      <div class="group">
        <div class="grow-row"><span>Con horario</span>
          <button type="button" class="switch ${D.timed ? 'on' : ''}" data-action="timed" role="switch" aria-checked="${D.timed}" aria-label="Con horario"><i></i></button></div>
        ${D.timed ? `<label class="grow-row"><span>Empieza</span><input type="time" data-field="start_time" value="${D.start_time || ''}"></label>
          <label class="grow-row"><span>Termina</span><input type="time" data-field="end_time" value="${D.end_time || ''}"></label>` : ''}
      </div>

      <div class="group">
        <label class="grow-row"><span>Lugar</span><input type="text" data-field="location" value="${esc(D.location || '')}" placeholder="Añadir lugar"></label>
        <div class="grow-row"><span>Estado</span>
          <div class="seg small">
            <button type="button" class="${D.status === 'confirmado' ? 'on' : ''}" data-action="status" data-v="confirmado">Confirmado</button>
            <button type="button" class="${D.status === 'pendiente' ? 'on' : ''}" data-action="status" data-v="pendiente">Pendiente</button>
          </div></div>
      </div>

      <label class="field"><span class="lab">NOTAS</span>
        <textarea data-field="notes" rows="3" placeholder="Con quién, reservas, qué llevar…">${esc(D.notes || '')}</textarea></label>

      ${D.id ? `<button type="button" class="btn danger" data-action="delete">${icon('trash', 18)} Borrar plan</button>` : ''}
    </section>
  </main>`;
}

function viewHolidays(year) {
  const official = Object.entries(HOLIDAYS).filter(([d]) => d.startsWith(String(year)))
    .map(([d, label]) => ({ d, label, custom: false }));
  const custom = Object.entries(S.extras).filter(([d, x]) => x.kind === 'festivo' && d.startsWith(String(year)))
    .map(([d, x]) => ({ d, label: x.label, custom: true }));
  const all = [...official, ...custom].sort((a, b) => a.d.localeCompare(b.d));
  const st = HOLIDAY_STATUS[year];
  const rows = all.length ? all.map((h) => `<div class="grow-row">
      <span class="hdate">${DOW_SHORT[dow(h.d)]} ${dayNum(h.d)} ${MONTHS_SHORT[monthIdx(h.d)].toLowerCase()}</span>
      <span class="grow">${esc(h.label)}${h.custom ? ' <span class="tag-own">PROPIO</span>' : ''}</span>
      ${h.custom ? `<button class="link danger-t" data-action="del-festivo" data-day="${h.d}" aria-label="Quitar festivo">Quitar</button>` : ''}
    </div>`).join('') : '<div class="grow-row"><span class="muted">Sin festivos para este año</span></div>';
  return `
  <main class="screen">
    <div class="nav"><a href="#/ajustes">${icon('back')} Ajustes</a></div>
    <header class="top tight row-between"><h1>Festivos</h1>${yearArrows('festivos', year)}</header>
    <section class="pad stack">
      ${st && st !== 'completo' ? `<div class="banner">${esc(st)}. La búsqueda mensual los añadirá cuando salgan.</div>` : ''}
      <div class="group">${rows}</div>
      <div class="field"><span class="lab">AÑADIR UN FESTIVO</span>
        <div class="group">
          <label class="grow-row"><span>Día</span><input id="fest-day" type="date" min="${year}-01-01" max="${year}-12-31"></label>
          <label class="grow-row"><span>Nombre</span><input id="fest-name" type="text" placeholder="p. ej. San Juan de Sahagún"></label>
        </div>
      </div>
      <button class="btn primary" data-action="add-festivo">Añadir festivo</button>
      <p class="muted sm">Los festivos que caen pegados a un finde (jueves, lunes o martes) lo alargan automáticamente. Los oficiales son los de España, Castilla y León y Salamanca capital.</p>
    </section>
    ${tabbar('ajustes')}
  </main>`;
}

// ---- avisos push

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function refreshPushState() {
  let st;
  if (!isStandalone()) st = 'not-installed';
  else if (!pushSupported()) st = 'unsupported';
  else if (Notification.permission === 'denied') st = 'denied';
  else st = (await currentSub()) ? 'on' : 'off';
  if (st !== S.push) { S.push = st; if (route().name === 'ajustes') render(); }
}

async function enablePush() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Sin permiso para avisos'); await refreshPushState(); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const r = await sb.from('push_subscriptions').upsert({
      endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: navigator.userAgent.slice(0, 120),
    });
    if (r.error) throw r.error;
    toast('Avisos activados en este iPhone');
  } catch (e) {
    toast('No se pudieron activar: ' + (e.message || e));
  }
  await refreshPushState();
}

async function disablePush() {
  const sub = await currentSub();
  if (sub) {
    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  toast('Avisos desactivados');
  await refreshPushState();
}

function pushSection() {
  const st = S.push;
  let txt; let btn = '';
  if (st === 'not-installed') txt = 'Para recibir avisos, abre Findes desde el icono de la pantalla de inicio (no desde Safari).';
  else if (st === 'unsupported') txt = 'Este dispositivo no admite avisos.';
  else if (st === 'denied') txt = 'Los avisos están bloqueados. Actívalos en Ajustes del iPhone → Notificaciones → Findes.';
  else if (st === 'on') {
    txt = 'Te avisaremos cuando el otro añada, cambie o borre algo.';
    btn = `<button class="btn" data-action="test-push">Enviar aviso de prueba</button>
           <button class="link sm" data-action="push-off">Desactivar avisos en este iPhone</button>`;
  } else if (st === 'off') {
    txt = 'Recibe un aviso cuando el otro añada, cambie o borre un plan.';
    btn = '<button class="btn primary" data-action="push-on">Activar avisos en este iPhone</button>';
  } else txt = 'Comprobando…';
  return `<div class="card-plain stack-s"><b>Avisos</b><p class="muted sm">${txt}</p>${btn}</div>`;
}

function viewSettings() {
  setTimeout(refreshPushState, 0);
  return `
  <main class="screen">
    <header class="top"><h1>Ajustes</h1></header>
    <section class="pad stack">
      <div class="group">
        <div class="grow-row"><span>Has entrado como</span><b>${esc(S.me.name)}</b></div>
        <div class="grow-row"><span>Email</span><span class="muted">${esc(S.session.user.email)}</span></div>
      </div>
      ${pushSection()}
      <a class="group link-row" href="#/festivos/${new Date().getFullYear()}">
        <div class="grow-row"><span>Festivos</span><span class="muted">Ver y añadir ${icon('next', 16)}</span></div>
      </a>
      <div class="group">
        <div class="grow-row"><span>Versión</span><span class="muted">${APP_VERSION}</span></div>
        <div class="grow-row"><span>Planes guardados</span><span class="muted">${S.plans.length}</span></div>
      </div>
      <div class="card-plain">
        <b>Instalar en el iPhone</b>
        <p class="muted sm">En Safari: botón Compartir → «Añadir a pantalla de inicio». Se abrirá a pantalla completa como una app.</p>
      </div>
      <button class="btn" data-action="logout">Cerrar sesión</button>
    </section>
    ${tabbar('ajustes')}
  </main>`;
}

// ------------------------------------------------------------------ acciones

async function save() {
  const D = S.draft;
  const title = (D.title || '').trim();
  if (!title) { toast('Ponle un nombre al plan'); document.getElementById('f-title')?.focus(); return; }
  if (D.date_to < D.date_from) { toast('La fecha final es anterior a la inicial'); return; }
  const row = {
    title, category: D.category, who: D.who, date_from: D.date_from, date_to: D.date_to,
    start_time: D.timed && D.start_time ? D.start_time : null,
    end_time: D.timed && D.end_time ? D.end_time : null,
    location: (D.location || '').trim() || null, status: D.status, notes: (D.notes || '').trim() || null,
  };
  S.busy = true;
  const res = D.id ? await sb.from('plans').update(row).eq('id', D.id) : await sb.from('plans').insert(row);
  S.busy = false;
  if (res.error) { toast('No se pudo guardar: ' + res.error.message); return; }
  const w = weekendContaining(row.date_from);
  S.draft = null; S.draftKey = null;
  await loadAll();
  location.hash = `#/finde/${w.id}`;
  toast('Plan guardado');
}

async function del() {
  const D = S.draft;
  if (!confirm(`¿Borrar «${D.title}»?`)) return;
  const res = await sb.from('plans').delete().eq('id', D.id);
  if (res.error) { toast('No se pudo borrar: ' + res.error.message); return; }
  const f = D.friday;
  S.draft = null; S.draftKey = null;
  await loadAll();
  location.hash = `#/finde/${f}`;
  toast('Plan borrado');
}

function toggleDay(day) {
  const D = S.draft;
  const inRange = D.date_from <= day && day <= D.date_to;
  if (!inRange) {
    if (day < D.date_from) D.date_from = day; else D.date_to = day;
  } else if (D.date_from === D.date_to) {
    return; // al menos un día
  } else if (day === D.date_from) {
    D.date_from = addDays(day, 1);
  } else if (day === D.date_to) {
    D.date_to = addDays(day, -1);
  } else {
    D.date_from = D.date_to = day; // tocar uno del medio: solo ese día
  }
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const D = S.draft;
  switch (a) {
    case 'filter': S.listFilter = el.dataset.v; render(); break;
    case 'search': S.searchOpen = !S.searchOpen; if (!S.searchOpen) S.search = ''; render();
      if (S.searchOpen) document.getElementById('search')?.focus(); break;
    case 'cat': D.category = el.dataset.v; render(); break;
    case 'who': D.who = el.dataset.v; render(); break;
    case 'status': D.status = el.dataset.v; render(); break;
    case 'day': toggleDay(el.dataset.day); render(); break;
    case 'timed': D.timed = !D.timed; render(); break;
    case 'multi': {
      D.multi = !D.multi;
      if (!D.multi) { const w = weekendById(D.friday); D.date_from = w.days.find((x) => x.base).date; D.date_to = w.sunday; }
      render(); break;
    }
    case 'save': await save(); break;
    case 'delete': await del(); break;
    case 'add-extra': {
      const r = await sb.from('extra_days').upsert({ day: el.dataset.day, label: 'Puente', kind: 'puente' });
      if (r.error) toast('Error: ' + r.error.message); else { await loadAll(); render(); }
      break;
    }
    case 'del-extra': {
      const r = await sb.from('extra_days').delete().eq('day', el.dataset.day);
      if (r.error) toast('Error: ' + r.error.message); else { await loadAll(); render(); }
      break;
    }
    case 'add-festivo': {
      const day = document.getElementById('fest-day').value;
      const label = document.getElementById('fest-name').value.trim() || 'Festivo';
      if (!day) { toast('Elige el día'); break; }
      const r = await sb.from('extra_days').upsert({ day, label, kind: 'festivo' });
      if (r.error) toast('Error: ' + r.error.message); else { await loadAll(); render(); toast('Festivo añadido'); }
      break;
    }
    case 'del-festivo': {
      const r = await sb.from('extra_days').delete().eq('day', el.dataset.day);
      if (r.error) toast('Error: ' + r.error.message); else { await loadAll(); render(); }
      break;
    }
    case 'push-on': await enablePush(); break;
    case 'push-off': await disablePush(); break;
    case 'test-push': {
      const r = await sb.rpc('test_push');
      toast(r.error ? 'Error: ' + r.error.message : 'Aviso enviado: debería llegar en unos segundos');
      break;
    }
    case 'logout': await sb.auth.signOut(); break;
    case 'retry': S.error = null; boot(); break;
    default: break;
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.field && S.draft) S.draft[el.dataset.field] = el.value;
  if (el.id === 'search') {
    S.search = el.value;
    const pos = el.selectionStart;
    render();
    const s = document.getElementById('search');
    if (s) { s.focus(); s.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.id === 'week-note') {
    const r = await sb.from('week_notes').upsert({ weekend: el.dataset.weekend, text: el.value });
    if (r.error) toast('No se pudo guardar la nota'); else { S.notes[el.dataset.weekend] = el.value; toast('Nota guardada'); }
  }
});

document.addEventListener('submit', async (ev) => {
  if (ev.target.id !== 'login-form') return;
  ev.preventDefault();
  const f = new FormData(ev.target);
  const errEl = document.getElementById('login-error');
  const btn = ev.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({
    email: String(f.get('email')).trim().toLowerCase(), password: String(f.get('password')),
  });
  if (error) {
    btn.disabled = false; btn.textContent = 'Entrar';
    errEl.textContent = error.message.includes('Invalid') ? 'Email o contraseña incorrectos' : error.message;
  }
});

window.addEventListener('hashchange', () => {
  const r = route();
  if (r.name !== 'plan' && r.name !== 'nuevo') { S.draft = null; S.draftKey = null; }
  render();
  window.scrollTo(0, 0);
});

// ------------------------------------------------------------------ arranque

async function boot() {
  render();
  if (!S.session) return;
  try {
    await loadAll();
    subscribe();
  } catch (e) {
    S.error = e.message || String(e);
  }
  render();
}

sb.auth.onAuthStateChange((event, session) => {
  const had = !!S.session;
  S.session = session;
  if (!session) {
    S.loaded = false; S.me = null; S.plans = [];
    if (channel) { sb.removeChannel(channel); channel = null; }
    render();
  } else if (!had) {
    boot();
  }
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.session && S.loaded) {
    try { await loadAll(); softRender(); } catch (_) { /* nada */ }
  }
});

render();
