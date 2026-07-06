// Convierte un temario de teoría (TheoryModuleWithLessons) en una secuencia de
// diapositivas para el modo presentación. Lógica pura y testeable: no toca el DOM.
//
// - Cada lección INTRO/CONTENT/EXAMPLE se trocea en bloques de markdown (separados
//   por línea en blanco) y se pagina en una o varias slides para que no se
//   sobrecarguen. Cada bloque es un "fragmento" que se revela progresivamente.
// - Las lecciones VIDEO se convierten en una slide de vídeo.
// - Se añade una portada al principio y una slide de cierre al final.
//
// Estructura Winston (temarios nuevos, con fallback para los antiguos):
// - La lección INTRO "Qué vas a conseguir" (promesa) y la CONTENT "Lo que te
//   llevas" (cierre) se marcan con `variant` para renderizarse como checklist.
// - Las lecciones EXAMPLE con la estructura pactada con la IA (### 💪 Ejemplo N +
//   Enunciado + pasos numerados + Resultado + Por qué funciona) se convierten en
//   slides `example` con pasos estructurados; si un bloque no parsea, degrada a
//   slide de contenido normal.

import type {
  TheoryLesson,
  TheoryModuleWithLessons,
  TheoryVideoCandidate,
} from '@vkbacademy/shared';

export type SlideKind = 'cover' | 'content' | 'video' | 'closing' | 'example';

/** Variante visual de una slide de contenido (checklist Winston / flashcards). */
export type ContentVariant = 'objectives' | 'takeaways' | 'summary';

/** Tarjeta de la variante summary: término + regla/fórmula ("- **término**: regla"). */
export interface SummaryCard {
  term: string;
  body: string;
}

export interface Slide {
  id: string;
  kind: SlideKind;
  /** Índice (1-based) dentro del total, se rellena en buildSlides. */
  index: number;
  /** Etiqueta corta para la vista de índice (vista G) y dots. */
  label: string;
  // cover
  coverTitle?: string;
  coverSubtitle?: string;
  topic?: string;
  // content
  heading?: string;
  /** Bloques de markdown; cada uno se revela como un fragmento. */
  blocks?: string[];
  /** Promesa inicial u "objetivos" / cierre "lo que te llevas" / chuleta "reglas de oro". */
  variant?: ContentVariant;
  /** Flashcards de la variante summary (se revelan antes que los blocks). */
  cards?: SummaryCard[];
  // example (ejercicio resuelto paso a paso)
  statement?: string;
  steps?: string[];
  result?: string;
  why?: string;
  // video
  candidates?: TheoryVideoCandidate[];
}

/** Presupuesto de caracteres por slide antes de empezar una nueva. */
const MAX_SLIDE_CHARS = 480;

/**
 * Elimina emojis iniciales de un heading (la IA marca los ejemplos con 💪 y
 * los temarios antiguos traen iconos): las slides van sin emoticonos.
 */
export function stripLeadingEmoji(text: string): string {
  return text.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/u, '').trim() || text;
}

/** Separa un markdown en bloques de nivel superior (párrafos, listas, callouts…). */
export function splitMarkdownBlocks(md: string): string[] {
  return md
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

function isHeading(block: string): boolean {
  return /^#{1,6}\s/.test(block);
}

/**
 * Agrupa bloques en páginas (slides) respetando un presupuesto de caracteres.
 * Un encabezado markdown fuerza el inicio de una nueva página. Siempre hay al
 * menos un bloque por página.
 */
export function paginateBlocks(blocks: string[], budget = MAX_SLIDE_CHARS): string[][] {
  const pages: string[][] = [];
  let current: string[] = [];
  let length = 0;

  for (const block of blocks) {
    const overflow = length + block.length > budget;
    const headingBreak = isHeading(block) && current.length > 0;
    if (current.length > 0 && (overflow || headingBreak)) {
      pages.push(current);
      current = [];
      length = 0;
    }
    current.push(block);
    length += block.length;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

const OBJECTIVES_RE = /qu[eé] vas a conseguir/i;
const TAKEAWAYS_RE = /lo que te llevas/i;
const SUMMARY_RE = /chuleta de repaso|reglas de oro|resumen/i;

/**
 * Detecta si una lección es la promesa inicial, el cierre Winston o la chuleta
 * de reglas clave por su heading. Los temarios antiguos ("Introducción", …) no
 * matchean y se renderizan como contenido normal.
 */
export function contentVariant(lesson: TheoryLesson): ContentVariant | undefined {
  if (lesson.kind === 'INTRO' && OBJECTIVES_RE.test(lesson.heading)) return 'objectives';
  if (TAKEAWAYS_RE.test(lesson.heading)) return 'takeaways';
  if (lesson.kind !== 'INTRO' && SUMMARY_RE.test(lesson.heading)) return 'summary';
  return undefined;
}

const SUMMARY_CARD_RE = /^[-*]\s+\*\*(.+?)\*\*[:.]?\s*(.*)$/;

/**
 * Extrae las flashcards de una slide summary: cada línea "- **término**: regla"
 * se convierte en tarjeta; el resto de líneas/bloques (callouts, párrafos) se
 * conserva como bloques normales. Si nada parsea, degrada a contenido normal.
 */
export function parseSummaryCards(blocks: string[]): { cards: SummaryCard[]; rest: string[] } {
  const cards: SummaryCard[] = [];
  const rest: string[] = [];

  for (const block of blocks) {
    const leftover: string[] = [];
    for (const line of block.split('\n')) {
      const match = line.trim().match(SUMMARY_CARD_RE);
      // El separador a veces queda dentro de la negrita ("- **Regla.** texto").
      if (match) cards.push({ term: match[1].trim().replace(/[:.]+$/, ''), body: match[2].trim() });
      else leftover.push(line);
    }
    const restBlock = leftover.join('\n').trim();
    if (restBlock) rest.push(restBlock);
  }

  return { cards, rest };
}

export interface ParsedExample {
  title: string;
  statement: string;
  steps: string[];
  result: string;
  why: string;
}

/** Divide el body de una lección EXAMPLE en trozos, uno por encabezado "###". */
export function splitExampleChunks(md: string): string[] {
  return md
    .replace(/\r\n/g, '\n')
    .split(/\n(?=###\s)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

/**
 * Parsea un ejemplo con la estructura pactada con la IA (### título +
 * **Enunciado:** + pasos numerados + **Resultado:** + **Por qué funciona:**).
 * Devuelve null si el trozo no cumple lo mínimo (título, enunciado, ≥2 pasos y
 * resultado) para que el llamador degrade a slide de contenido normal.
 */
export function parseExample(chunk: string): ParsedExample | null {
  const lines = chunk.replace(/\r\n/g, '\n').split('\n');
  const headingMatch = lines[0]?.match(/^###\s+(.+)$/);
  if (!headingMatch) return null;

  const title = stripLeadingEmoji(headingMatch[1].trim());
  let statement = '';
  const steps: string[] = [];
  let result = '';
  let why = '';
  let target: 'statement' | 'steps' | 'result' | 'why' | null = null;

  const append = (acc: string, text: string) => (acc ? `${acc} ${text}` : text);

  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line) continue;

    const labeled = line.match(/^\*\*(Enunciado|Resultado|Por qué funciona)[:.]?\*\*[:.]?\s*(.*)$/i);
    if (labeled) {
      const label = labeled[1].toLowerCase();
      target = label.startsWith('enunciado') ? 'statement' : label.startsWith('resultado') ? 'result' : 'why';
      const rest = labeled[2].trim();
      if (rest) {
        if (target === 'statement') statement = append(statement, rest);
        else if (target === 'result') result = append(result, rest);
        else why = append(why, rest);
      }
      continue;
    }

    const stepMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (stepMatch) {
      steps.push(stepMatch[1].trim());
      target = 'steps';
      continue;
    }

    // Línea suelta: continuación del bloque activo (párrafos multilínea).
    if (target === 'steps' && steps.length > 0) steps[steps.length - 1] = append(steps[steps.length - 1], line);
    else if (target === 'statement') statement = append(statement, line);
    else if (target === 'result') result = append(result, line);
    else if (target === 'why') why = append(why, line);
  }

  if (!statement || steps.length < 2 || !result) return null;
  return { title, statement, steps, result, why };
}

/**
 * Resuelve los candidatos de vídeo de una lección. Compat: lecciones antiguas
 * solo tienen youtubeId (sin lista de candidatos).
 */
export function resolveVideoCandidates(lesson: TheoryLesson): TheoryVideoCandidate[] {
  if (lesson.videoCandidates && lesson.videoCandidates.length > 0) {
    return lesson.videoCandidates;
  }
  if (lesson.youtubeId) {
    return [
      {
        youtubeId: lesson.youtubeId,
        title: lesson.heading,
        channelTitle: '',
        durationSeconds: 0,
        thumbnailUrl: `https://img.youtube.com/vi/${lesson.youtubeId}/mqdefault.jpg`,
      },
    ];
  }
  return [];
}

/** Construye la secuencia completa de slides para un temario. */
export function buildSlides(module: TheoryModuleWithLessons): Slide[] {
  const slides: Array<Omit<Slide, 'index' | 'label'>> = [];

  slides.push({
    id: 'cover',
    kind: 'cover',
    coverTitle: module.title,
    coverSubtitle: module.summary,
    topic: module.topic,
  });

  for (const lesson of module.lessons) {
    if (lesson.kind === 'VIDEO') {
      slides.push({
        id: lesson.id,
        kind: 'video',
        heading: stripLeadingEmoji(lesson.heading),
        candidates: resolveVideoCandidates(lesson),
      });
      continue;
    }

    if (lesson.kind === 'EXAMPLE') {
      let emitted = 0;
      for (const [i, chunk] of splitExampleChunks(lesson.body ?? '').entries()) {
        const parsed = parseExample(chunk);
        if (parsed) {
          slides.push({
            id: `${lesson.id}-ex${i}`,
            kind: 'example',
            heading: parsed.title,
            statement: parsed.statement,
            steps: parsed.steps,
            result: parsed.result,
            why: parsed.why,
          });
          emitted++;
          continue;
        }
        // Trozo sin estructura de ejemplo (preámbulo o temario antiguo): paginar como contenido.
        const pages = paginateBlocks(splitMarkdownBlocks(chunk));
        pages.forEach((pageBlocks, j) => {
          slides.push({
            id: `${lesson.id}-${i}-${j}`,
            kind: 'content',
            heading: stripLeadingEmoji(lesson.heading),
            blocks: pageBlocks,
          });
          emitted++;
        });
      }
      if (emitted === 0) {
        slides.push({
          id: `${lesson.id}-0`,
          kind: 'content',
          heading: stripLeadingEmoji(lesson.heading),
          blocks: [''],
        });
      }
      continue;
    }

    const variant = contentVariant(lesson);
    const blocks = splitMarkdownBlocks(lesson.body ?? '');
    // Las variantes (promesa, cierre, chuleta) son autocontenidas: siempre en
    // una sola slide (paginarlas dejaría huérfanos el callout o las tarjetas).
    const pages =
      blocks.length === 0 ? [['']] : variant ? [blocks] : paginateBlocks(blocks);
    pages.forEach((pageBlocks, i) => {
      if (variant === 'summary') {
        const { cards, rest } = parseSummaryCards(pageBlocks);
        slides.push({
          id: `${lesson.id}-${i}`,
          kind: 'content',
          heading: stripLeadingEmoji(lesson.heading),
          blocks: rest,
          variant,
          cards,
        });
        return;
      }
      slides.push({
        id: `${lesson.id}-${i}`,
        kind: 'content',
        heading: stripLeadingEmoji(lesson.heading),
        blocks: pageBlocks,
        variant,
      });
    });
  }

  slides.push({ id: 'closing', kind: 'closing' });

  return slides.map((slide, i) => ({
    ...slide,
    index: i + 1,
    label: slideLabel(slide, i),
  }));
}

function slideLabel(slide: Omit<Slide, 'index' | 'label'>, i: number): string {
  if (slide.kind === 'cover') return 'Portada';
  if (slide.kind === 'closing') return 'Fin';
  if (slide.kind === 'video') return slide.heading ?? 'Vídeo';
  return slide.heading ?? `Slide ${i + 1}`;
}

/** Nº de fragmentos revelables de una slide (bloques, tarjetas o piezas del ejemplo). */
export function fragmentCount(slide: Slide): number {
  if (slide.kind === 'example') {
    // enunciado + pasos + resultado + porqué (si existe)
    return 1 + (slide.steps?.length ?? 0) + 1 + (slide.why ? 1 : 0);
  }
  if (slide.kind !== 'content') return 0;
  return (slide.cards?.length ?? 0) + (slide.blocks?.length ?? 0);
}
