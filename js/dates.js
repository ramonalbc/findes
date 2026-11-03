// Motor de fechas: calcula los fines de semana de cada año.
// Todo se trabaja en UTC con cadenas 'YYYY-MM-DD' para evitar líos con el cambio de hora.

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
export const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DOW_LETTER = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const DOW_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const DAY = 86400000;

export function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function iso(date) {
  return date.toISOString().slice(0, 10);
}
export function addDays(isoStr, n) {
  return iso(new Date(parse(isoStr).getTime() + n * DAY));
}
export function dow(isoStr) {
  return parse(isoStr).getUTCDay();
}
export function dayNum(isoStr) {
  return Number(isoStr.slice(8, 10));
}
export function monthIdx(isoStr) {
  return Number(isoStr.slice(5, 7)) - 1;
}
export function diffDays(a, b) {
  return Math.round((parse(b) - parse(a)) / DAY);
}
export function todayIso() {
  const now = new Date();
  return iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

// Un día "libre" que alarga el finde: festivo oficial o día marcado a mano (puente).
// offInfo(day) devuelve { kind: 'holiday'|'extra', label } o null.

const MAX_BEFORE = 2; // como mucho miércoles
const MAX_AFTER = 2;  // como mucho martes

/**
 * Fin de semana que contiene el viernes `friday`, alargado con festivos o puentes pegados.
 */
export function buildWeekend(friday, offInfo) {
  let start = friday;
  let end = addDays(friday, 2);
  for (let i = 0; i < MAX_BEFORE && offInfo(addDays(start, -1)); i++) start = addDays(start, -1);
  for (let i = 0; i < MAX_AFTER && offInfo(addDays(end, 1)); i++) end = addDays(end, 1);
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const w = dow(d);
    const base = w === 5 || w === 6 || w === 0;
    const off = offInfo(d);
    days.push({
      date: d,
      dow: w,
      kind: off ? off.kind : 'base',
      label: off ? off.label : null,
      base,
    });
  }
  const sunday = addDays(friday, 2);
  return {
    id: friday,           // el viernes identifica al finde
    friday,
    start,
    end,
    sunday,
    month: monthIdx(sunday), // el finde va en el mes en que termina su domingo
    year: Number(sunday.slice(0, 4)),
    days,
    extended: days.length > 3,
  };
}

/** Todos los findes cuyo domingo cae en `year`. */
export function weekendsOfYear(year, offInfo) {
  let d = `${year}-01-01`;
  while (dow(d) !== 0) d = addDays(d, 1);           // primer domingo del año
  const out = [];
  for (let sunday = d; sunday.startsWith(String(year)); sunday = addDays(sunday, 7)) {
    out.push(buildWeekend(addDays(sunday, -2), offInfo));
  }
  return out;
}

/** Viernes del finde al que pertenece una fecha (o el siguiente si es entre semana). */
export function fridayFor(isoStr) {
  const w = dow(isoStr);
  if (w === 5) return isoStr;
  if (w === 6) return addDays(isoStr, -1);
  if (w === 0) return addDays(isoStr, -2);
  return addDays(isoStr, (5 - w + 7) % 7);
}

/** "13–15", o "30 oct – 2 nov" si cambia de mes y se pide largo. */
export function rangeLabel(start, end) {
  return `${dayNum(start)}–${dayNum(end)}`;
}

export function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom <= bTo && bFrom <= aTo;
}
