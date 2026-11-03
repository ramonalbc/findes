// Festivos que afectan a Salamanca capital: nacionales, de Castilla y León y locales.
// Fuentes: BOE (relación anual de fiestas laborales), BOCYL (Decreto 9/2025 para 2026,
// Decreto 7/2026 para 2027) y calendario local de Salamanca.
// Revisar cada otoño, cuando se publican los del año siguiente.

// Estado de los festivos oficiales por año. 'completo' = nacionales + CyL + locales de Salamanca.
// Lo mantiene al día la búsqueda mensual programada.
export const HOLIDAY_STATUS = {
  2026: 'completo',
  2027: 'Faltan los 2 festivos locales de Salamanca (aún sin publicar)',
  2028: 'Aún no se han publicado los festivos de 2028',
};

export const HOLIDAYS = {
  // ---- 2026 ----
  '2026-01-01': 'Año Nuevo',
  '2026-01-06': 'Reyes',
  '2026-04-02': 'Jueves Santo',
  '2026-04-03': 'Viernes Santo',
  '2026-04-23': 'Día de Castilla y León',
  '2026-05-01': 'Día del Trabajo',
  '2026-06-12': 'San Juan de Sahagún',
  '2026-08-15': 'Asunción',
  '2026-09-08': 'Virgen de la Vega',
  '2026-10-12': 'Fiesta Nacional',
  '2026-11-02': 'Todos los Santos (trasladado)',
  '2026-12-07': 'Constitución (trasladado)',
  '2026-12-08': 'Inmaculada',
  '2026-12-25': 'Navidad',

  // ---- 2027 ---- (faltan los 2 locales de Salamanca, aún sin publicar)
  '2027-01-01': 'Año Nuevo',
  '2027-01-06': 'Reyes',
  '2027-03-25': 'Jueves Santo',
  '2027-03-26': 'Viernes Santo',
  '2027-04-23': 'Día de Castilla y León',
  '2027-05-01': 'Día del Trabajo',
  '2027-08-16': 'Asunción (trasladado)',
  '2027-10-12': 'Fiesta Nacional',
  '2027-11-01': 'Todos los Santos',
  '2027-12-06': 'Constitución',
  '2027-12-08': 'Inmaculada',
  '2027-12-25': 'Navidad',
};
