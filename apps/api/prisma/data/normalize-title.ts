// Normaliza un título para comparación: trim + minúsculas + sin diacríticos (acentos, virgulillas, etc.).
// Compartido entre los scripts de seed/validación que necesitan detectar duplicados por título
// sin que las diferencias de mayúsculas o acentuación cuenten como asignaturas/unidades distintas.
export function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Marca de diacríticos: U+0300 a U+036F (tildes, virgulillas, etc.)
    .replace(/[̀-ͯ]/g, '');
}
