// Reparto determinista de N items entre T temas: base floor(N/T) por tema,
// el resto (N % T) se asigna de uno en uno a los primeros temas.
// Compartido por la generación multi-tema de ejercicios y exámenes.
export function splitAcrossTopics(count: number, topicCount: number): number[] {
  const base = Math.floor(count / topicCount);
  const rest = count % topicCount;
  return Array.from({ length: topicCount }, (_, i) => base + (i < rest ? 1 : 0));
}
