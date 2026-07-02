// Extrae el mensaje de error del backend (HttpException de NestJS) desde una respuesta de Axios.
// Reutiliza el mismo shape { response: { data: { message } } } que ya se lee de forma inline
// en BookingsPage.tsx / StudyPage.tsx, para no dejar mutaciones con fallo silencioso.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } } | null)?.response
    ?.data?.message;
  if (Array.isArray(data)) return data.join(' · ');
  if (typeof data === 'string' && data.length > 0) return data;
  return fallback;
}
