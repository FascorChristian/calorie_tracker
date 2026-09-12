/**
 * Utilidades para manejo seguro de fechas y compatibilidad con MySQL
 * con soporte nativo para la zona horaria de Santiago de Chile (America/Santiago).
 */

export const CHILE_TIMEZONE = 'America/Santiago';

/**
 * Desglosa una fecha en sus partes componentes en la zona horaria de Santiago (Chile).
 */
export function getSantiagoDateParts(d?: string | Date | null): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  let validDate: Date;
  if (!d) {
    validDate = new Date();
  } else if (d instanceof Date) {
    validDate = isNaN(d.getTime()) ? new Date() : d;
  } else {
    const parsed = new Date(d);
    validDate = isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(validDate);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return {
    year: map.year || '2026',
    month: map.month || '01',
    day: map.day || '01',
    hour: map.hour || '00',
    minute: map.minute || '00',
    second: map.second || '00',
  };
}

/**
 * Obtiene la fecha actual en Santiago de Chile en formato 'YYYY-MM-DD'.
 */
export function getTodayString(d?: string | Date | null): string {
  const { year, month, day } = getSantiagoDateParts(d);
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene la hora actual en Santiago de Chile en formato 'HH:MM'.
 */
export function getSantiagoTimeString(d?: string | Date | null): string {
  const { hour, minute } = getSantiagoDateParts(d);
  return `${hour}:${minute}`;
}

/**
 * Desarma cualquier fecha y la rearma estrictamente en el formato requerido
 * por MySQL DATETIME: 'YYYY-MM-DD HH:MM:SS', respetando la hora de Santiago (Chile).
 */
export function formatToMysqlDateTime(d?: string | Date | null): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(d)) {
    return d;
  }
  const { year, month, day, hour, minute, second } = getSantiagoDateParts(d);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
