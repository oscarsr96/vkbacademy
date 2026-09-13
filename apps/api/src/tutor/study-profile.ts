import { TUTOR_DEFAULT_IMAGE_PROMPT } from '@vkbacademy/shared';

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

// ─── Practicar este tema (#141) ─────────────────────────────────────────────

/** Tema de un plan del alumno, candidato a "practicar esto". */
export interface PracticeCandidate {
  title: string;
  courseId: string;
  courseTitle: string;
  moduleId: string | null;
  /** Aparece entre los temas que le cuestan. */
  weak: boolean;
}

/** Lo que viaja al cliente en el evento `done` para montar el enlace a Estudiar. */
export interface PracticeSuggestion {
  title: string;
  courseId: string;
  courseTitle: string;
  moduleId: string | null;
}

/** Títulos muy cortos casan con cualquier cosa ("la", "el"). */
const MIN_TOPIC_LENGTH = 3;

/**
 * Con foto y sin pregunta propia, solo cuenta el arranque de la respuesta:
 * el prompt pide al modelo que empiece describiendo el ejercicio que ve.
 * Más allá, la explicación menciona otros temas de pasada.
 */
const ANSWER_HEAD_CHARS = 200;

/** Lo que dijo el alumno y lo que respondió el tutor en este turno. */
export interface PracticeExchange {
  question: string;
  answer: string;
  hadImage: boolean;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isDefaultPhotoQuestion(question: string): boolean {
  return normalize(question).trim() === normalize(TUTOR_DEFAULT_IMAGE_PROMPT).trim();
}

/**
 * Qué tema del alumno toca la duda, sin preguntar a la IA. Se busca el
 * título de cada tema de sus planes (sin acentos ni mayúsculas) en lo que
 * ha preguntado el alumno; la respuesta del modelo NO cuenta — menciona
 * temas de pasada y en PROD llegó a proponer figuras geométricas a quien
 * preguntaba por fracciones. Única excepción: foto sin pregunta propia,
 * donde se mira el arranque de la respuesta (la descripción del ejercicio).
 * Gana el tema flojo; a igualdad, el título más largo (más específico).
 */
export function suggestPracticeTopic(
  exchange: PracticeExchange,
  candidates: PracticeCandidate[],
): PracticeSuggestion | null {
  const source =
    exchange.hadImage && isDefaultPhotoQuestion(exchange.question)
      ? exchange.answer.slice(0, ANSWER_HEAD_CHARS)
      : exchange.question;
  const haystack = normalize(source);

  const hits = candidates.filter((c) => {
    const needle = normalize(c.title).trim();
    return needle.length >= MIN_TOPIC_LENGTH && haystack.includes(needle);
  });
  if (hits.length === 0) return null;

  hits.sort((a, b) => Number(b.weak) - Number(a.weak) || b.title.length - a.title.length);
  const { title, courseId, courseTitle, moduleId } = hits[0];
  return { title, courseId, courseTitle, moduleId };
}
