import { describe, expect, it } from 'vitest';
import type { TheoryModuleWithLessons, TheoryLesson } from '@vkbacademy/shared';
import {
  buildSlides,
  fragmentCount,
  paginateBlocks,
  resolveVideoCandidates,
  splitMarkdownBlocks,
} from './theorySlides';

function lesson(partial: Partial<TheoryLesson>): TheoryLesson {
  return {
    id: 'l1',
    moduleId: 'm1',
    order: 0,
    kind: 'CONTENT',
    heading: 'Sección',
    body: '',
    youtubeId: null,
    videoCandidates: null,
    ...partial,
  };
}

function moduleWith(lessons: TheoryLesson[]): TheoryModuleWithLessons {
  return {
    id: 'm1',
    userId: 'u1',
    courseId: 'c1',
    topic: 'ecuaciones de segundo grado',
    title: 'Ecuaciones de 2º grado',
    summary: 'Aprende a resolverlas.',
    createdAt: '2026-06-30T00:00:00.000Z',
    lessons,
  };
}

describe('splitMarkdownBlocks', () => {
  it('separa por líneas en blanco y limpia bloques vacíos', () => {
    expect(splitMarkdownBlocks('a\n\nb\n\n\n  c  ')).toEqual(['a', 'b', 'c']);
  });

  it('normaliza CRLF', () => {
    expect(splitMarkdownBlocks('a\r\n\r\nb')).toEqual(['a', 'b']);
  });

  it('devuelve vacío para cadena en blanco', () => {
    expect(splitMarkdownBlocks('   \n\n  ')).toEqual([]);
  });
});

describe('paginateBlocks', () => {
  it('empieza una nueva página cuando se supera el presupuesto', () => {
    const a = 'a'.repeat(300);
    const b = 'b'.repeat(300);
    expect(paginateBlocks([a, b], 480)).toEqual([[a], [b]]);
  });

  it('mantiene bloques juntos si caben', () => {
    expect(paginateBlocks(['uno', 'dos'], 480)).toEqual([['uno', 'dos']]);
  });

  it('un encabezado fuerza nueva página', () => {
    expect(paginateBlocks(['intro', '## Título', 'más'], 9999)).toEqual([
      ['intro'],
      ['## Título', 'más'],
    ]);
  });

  it('siempre al menos un bloque por página aunque exceda el presupuesto', () => {
    const huge = 'x'.repeat(2000);
    expect(paginateBlocks([huge], 480)).toEqual([[huge]]);
  });
});

describe('resolveVideoCandidates', () => {
  it('usa videoCandidates cuando existen', () => {
    const c = {
      youtubeId: 'abc',
      title: 'T',
      channelTitle: 'C',
      durationSeconds: 60,
      thumbnailUrl: 'x',
    };
    expect(resolveVideoCandidates(lesson({ kind: 'VIDEO', videoCandidates: [c] }))).toEqual([c]);
  });

  it('compat: construye un candidato a partir de youtubeId', () => {
    const out = resolveVideoCandidates(lesson({ kind: 'VIDEO', youtubeId: 'xyz' }));
    expect(out).toHaveLength(1);
    expect(out[0].youtubeId).toBe('xyz');
    expect(out[0].thumbnailUrl).toContain('xyz');
  });

  it('devuelve vacío si no hay vídeo', () => {
    expect(resolveVideoCandidates(lesson({ kind: 'VIDEO' }))).toEqual([]);
  });
});

describe('buildSlides', () => {
  it('añade portada al principio y cierre al final', () => {
    const slides = buildSlides(moduleWith([lesson({ body: 'hola' })]));
    expect(slides[0].kind).toBe('cover');
    expect(slides[0].coverTitle).toBe('Ecuaciones de 2º grado');
    expect(slides[slides.length - 1].kind).toBe('closing');
  });

  it('convierte una lección VIDEO en una slide de vídeo con candidatos', () => {
    const slides = buildSlides(
      moduleWith([lesson({ kind: 'VIDEO', heading: 'Vídeo', youtubeId: 'v1' })]),
    );
    const video = slides.find((s) => s.kind === 'video');
    expect(video).toBeDefined();
    expect(video?.candidates?.[0].youtubeId).toBe('v1');
  });

  it('pagina una lección de contenido larga en varias slides', () => {
    const body = `${'a'.repeat(300)}\n\n${'b'.repeat(300)}`;
    const slides = buildSlides(moduleWith([lesson({ kind: 'CONTENT', body })]));
    const content = slides.filter((s) => s.kind === 'content');
    expect(content.length).toBe(2);
    expect(content[1].continued).toBe(true);
  });

  it('numera las slides de forma correlativa', () => {
    const slides = buildSlides(moduleWith([lesson({ body: 'x' })]));
    expect(slides.map((s) => s.index)).toEqual(slides.map((_, i) => i + 1));
  });
});

describe('fragmentCount', () => {
  it('cuenta los bloques de una slide de contenido', () => {
    const slides = buildSlides(moduleWith([lesson({ kind: 'CONTENT', body: 'uno\n\ndos' })]));
    const content = slides.find((s) => s.kind === 'content')!;
    expect(fragmentCount(content)).toBe(2);
  });

  it('es 0 para portada y vídeo', () => {
    const slides = buildSlides(moduleWith([lesson({ kind: 'VIDEO', youtubeId: 'v' })]));
    expect(fragmentCount(slides[0])).toBe(0); // cover
    expect(fragmentCount(slides.find((s) => s.kind === 'video')!)).toBe(0);
  });
});
