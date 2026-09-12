/**
 * Perfil de estudio del alumno para el tutor: lo que está estudiando y lo
 * que le cuesta, en pocas líneas de system prompt. Funciones puras; los datos
 * los carga TutorService.
 */

export interface WeakTopic {
  topicLabel: string;
  failed: number;
  total: number;
}

export interface StudyProfile {
  /** Etiqueta del curso ("2º ESO") o null si el alumno no tiene curso asignado. */
  schoolYear: string | null;
  /** Últimos planes de Estudiar, del más reciente al más antiguo. */
  plans: { title: string; course: string }[];
  weakTopics: WeakTopic[];
}

/** Cuántos planes y temas van al prompt: suficiente para orientar, poco para no comer tokens. */
export const MAX_PROFILE_PLANS = 3;
export const MAX_WEAK_TOPICS = 3;

/**
 * Temas con más fallos (verdict distinto de "correct") entre los intentos
 * dados, de más a menos fallos. Un tema sin fallos no es flojo.
 */
export function rankWeakTopics(
  attempts: { topicLabel: string; verdict: string }[],
  limit: number = MAX_WEAK_TOPICS,
): WeakTopic[] {
  const byTopic = new Map<string, WeakTopic>();
  for (const a of attempts) {
    const entry = byTopic.get(a.topicLabel) ?? { topicLabel: a.topicLabel, failed: 0, total: 0 };
    entry.total += 1;
    if (a.verdict !== 'correct') entry.failed += 1;
    byTopic.set(a.topicLabel, entry);
  }
  return [...byTopic.values()]
    .filter((t) => t.failed > 0)
    .sort((a, b) => b.failed - a.failed || b.total - a.total || a.topicLabel.localeCompare(b.topicLabel))
    .slice(0, limit);
}

/** Líneas para el system prompt. Vacío si no hay nada que contar. */
export function buildStudyProfileLines(profile: StudyProfile): string[] {
  const lines: string[] = [];

  if (profile.schoolYear) {
    lines.push(`El alumno está en ${profile.schoolYear}.`);
  }

  if (profile.plans.length > 0) {
    const plans = profile.plans
      .slice(0, MAX_PROFILE_PLANS)
      .map((p) => `${p.title} (${p.course})`)
      .join('; ');
    lines.push(`Está estudiando con estos planes: ${plans}.`);
  }

  if (profile.weakTopics.length > 0) {
    const topics = profile.weakTopics
      .slice(0, MAX_WEAK_TOPICS)
      .map((t) => `${t.topicLabel} (${t.failed} fallos de ${t.total})`)
      .join('; ');
    lines.push(
      `Temas que le cuestan según sus ejercicios recientes: ${topics}. Si la duda toca alguno, empieza por ahí y ve más despacio; no se lo reproches.`,
    );
  }

  return lines;
}
