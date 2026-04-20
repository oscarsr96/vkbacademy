/**
 * Convierte una duración ISO 8601 de YouTube (ej: "PT1H2M30S") a segundos.
 * Solo soporta H/M/S (no días/semanas, no relevantes para YouTube).
 * Devuelve 0 para entradas inválidas.
 */
export function parseDurationISO8601(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const [, h, m, s] = match;
  if (!h && !m && !s) return 0;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}
