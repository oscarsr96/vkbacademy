// Convierte un temario de teoría (TheoryModuleWithLessons) en una secuencia de
// diapositivas para el modo presentación. Lógica pura y testeable: no toca el DOM.
//
// - Cada lección INTRO/CONTENT/EXAMPLE se trocea en bloques de markdown (separados
//   por línea en blanco) y se pagina en una o varias slides para que no se
//   sobrecarguen. Cada bloque es un "fragmento" que se revela progresivamente.
// - Las lecciones VIDEO se convierten en una slide de vídeo.
// - Se añade una portada al principio y una slide de cierre al final.

import type {
  TheoryLesson,
  TheoryLessonKind,
  TheoryModuleWithLessons,
  TheoryVideoCandidate,
} from '@vkbacademy/shared';

export type SlideKind = 'cover' | 'content' | 'video' | 'closing';

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
  icon?: string;
  heading?: string;
  /** Bloques de markdown; cada uno se revela como un fragmento. */
  blocks?: string[];
  /** true si es continuación de una lección dividida en varias slides. */
  continued?: boolean;
  // video
  candidates?: TheoryVideoCandidate[];
}

export const KIND_ICON: Record<TheoryLessonKind, string> = {
  INTRO: '🧭',
  CONTENT: '📚',
  EXAMPLE: '💡',
  VIDEO: '▶️',
};

/** Presupuesto de caracteres por slide antes de empezar una nueva. */
const MAX_SLIDE_CHARS = 480;

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
        icon: KIND_ICON.VIDEO,
        heading: lesson.heading,
        candidates: resolveVideoCandidates(lesson),
      });
      continue;
    }

    const blocks = splitMarkdownBlocks(lesson.body ?? '');
    const pages = blocks.length > 0 ? paginateBlocks(blocks) : [['']];
    pages.forEach((pageBlocks, i) => {
      slides.push({
        id: `${lesson.id}-${i}`,
        kind: 'content',
        icon: KIND_ICON[lesson.kind],
        heading: lesson.heading,
        blocks: pageBlocks,
        continued: i > 0,
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
  const base = slide.heading ?? `Slide ${i + 1}`;
  return slide.continued ? `${base} (cont.)` : base;
}

/** Nº de fragmentos revelables de una slide (los bloques de contenido). */
export function fragmentCount(slide: Slide): number {
  return slide.kind === 'content' ? (slide.blocks?.length ?? 0) : 0;
}
