// Todo el cálculo de fechas del BCV se hace en hora de Venezuela.
// America/Caracas es UTC-4 y no observa horario de verano.
export const TZ = 'America/Caracas';

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

// Fecha calendario (YYYY-MM-DD) de un instante, en hora de Venezuela.
// 'en-CA' formatea justamente como YYYY-MM-DD.
export function caracasDate(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

// Normaliza la "fecha valor" que publica el BCV a YYYY-MM-DD.
// Acepta ISO con offset ("2026-07-08T00:00:00-04:00"), dd/mm/aaaa,
// o texto en español ("Miércoles, 08 Julio 2026").
export function normalizeFechaValor(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  const txt = s
    .toLowerCase()
    .match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)\s*(?:de\s+)?(\d{4})/);
  if (txt) {
    const mon = MESES[txt[2]];
    if (mon) {
      return `${txt[3]}-${String(mon).padStart(2, '0')}-${txt[1].padStart(2, '0')}`;
    }
  }

  return null;
}
