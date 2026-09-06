/**
 * Utilidades para manejo seguro de fechas y compatibilidad con MySQL.
 */

/**
 * Obtiene la fecha actual en formato local 'YYYY-MM-DD'.
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Desarma cualquier fecha (ISO string, objeto Date, etc.) y la rearma estrictamente
 * en el formato requerido por MySQL DATETIME: 'YYYY-MM-DD HH:MM:SS'
 */
export function formatToMysqlDateTime(d?: string | Date | null): string {
  const date = d ? new Date(d) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = validDate.getFullYear();
  const month = pad(validDate.getMonth() + 1);
  const day = pad(validDate.getDate());
  const hours = pad(validDate.getHours());
  const minutes = pad(validDate.getMinutes());
  const seconds = pad(validDate.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

