import { describe, expect, it } from 'vitest';
import type { TheoryModuleWithLessons, TheoryLesson } from '@vkbacademy/shared';
import {
  buildSlides,
  fragmentCount,
  paginateBlocks,
  parseExample,
  resolveVideoCandidates,
  splitExampleChunks,
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

const EXAMPLE_MD = `### 💪 Ejemplo 1: descuento de rebajas
**Enunciado:** Unas zapatillas de 60 € tienen un 25 % de descuento. ¿Cuánto pagas?
1. Calcula el 25 % de 60: $60 \\cdot 0{,}25 = 15$.
2. Resta el descuento al precio: $60 - 15 = 45$.
3. Comprueba que el resultado es menor que el original.
**Resultado:** Pagas 45 €.
**Por qué funciona:** El porcentaje es una fracción del total, así que multiplicar y restar equivale a quedarte con el 75 %.`;

describe('splitExampleChunks', () => {
  it('separa por encabezados ### conservando el preámbulo', () => {
    const chunks = splitExampleChunks(`intro suelta\n\n### 💪 Ejemplo 1: a\ncuerpo\n### 💪 Ejemplo 2: b\ncuerpo`);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toBe('intro suelta');
    expect(chunks[1].startsWith('### 💪 Ejemplo 1')).toBe(true);
  });
});

describe('parseExample', () => {
  it('parsea título, enunciado, pasos, resultado y porqué', () => {
    const parsed = parseExample(EXAMPLE_MD)!;
    expect(parsed).not.toBeNull();
    expect(parsed.title).toBe('💪 Ejemplo 1: descuento de rebajas');
    expect(parsed.statement).toContain('zapatillas');
    expect(parsed.steps).toHaveLength(3);
    expect(parsed.steps[1]).toContain('Resta el descuento');
    expect(parsed.result).toBe('Pagas 45 €.');
    expect(parsed.why).toContain('porcentaje');
  });

  it('une líneas de continuación al bloque activo', () => {
    const md = `### Ejemplo\n**Enunciado:** primera línea\nsegunda línea\n1. paso uno\ncontinuación del paso\n2. paso dos\n**Resultado:** listo`;
    const parsed = parseExample(md)!;
    expect(parsed.statement).toBe('primera línea segunda línea');
    expect(parsed.steps[0]).toBe('paso uno continuación del paso');
  });

  it('devuelve null sin encabezado ###', () => {
    expect(parseExample('**Enunciado:** x\n1. a\n2. b\n**Resultado:** y')).toBeNull();
  });

  it('devuelve null con menos de 2 pasos o sin resultado (degrada a contenido)', () => {
    expect(parseExample('### E\n**Enunciado:** x\n1. solo un paso\n**Resultado:** y')).toBeNull();
    expect(parseExample('### E\n**Enunciado:** x\n1. a\n2. b')).toBeNull();
  });
});

describe('buildSlides — estructura Winston', () => {
  it('marca la INTRO "Qué vas a conseguir" como variante objectives con icono 🎯', () => {
    const slides = buildSlides(
      moduleWith([lesson({ kind: 'INTRO', heading: 'Qué vas a conseguir', body: '- **Sabrás** x' })]),
    );
    const intro = slides.find((s) => s.kind === 'content')!;
    expect(intro.variant).toBe('objectives');
    expect(intro.icon).toBe('🎯');
  });

  it('marca "Lo que te llevas" como variante takeaways', () => {
    const slides = buildSlides(
      moduleWith([lesson({ kind: 'CONTENT', heading: 'Lo que te llevas', body: '- **Ya sabes** x' })]),
    );
    expect(slides.find((s) => s.kind === 'content')!.variant).toBe('takeaways');
  });

  it('la promesa no se pagina aunque supere el presupuesto de caracteres', () => {
    const body = `frase de arranque\n\n- **Sabrás** ${'x'.repeat(300)}\n- **Sabrás** ${'y'.repeat(300)}\n\n> 💡 **Tip:** entiende la regla única.`;
    const slides = buildSlides(
      moduleWith([lesson({ kind: 'INTRO', heading: 'Qué vas a conseguir', body })]),
    );
    const content = slides.filter((s) => s.kind === 'content');
    expect(content).toHaveLength(1);
    expect(content[0].blocks).toHaveLength(3);
  });

  it('compat: una INTRO clásica no lleva variante', () => {
    const slides = buildSlides(
      moduleWith([lesson({ kind: 'INTRO', heading: 'Introducción', body: 'hola' })]),
    );
    expect(slides.find((s) => s.kind === 'content')!.variant).toBeUndefined();
  });

  it('convierte una lección EXAMPLE estructurada en slides example con pasos', () => {
    const body = `${EXAMPLE_MD}\n${EXAMPLE_MD.replace('Ejemplo 1', 'Ejemplo 2')}`;
    const slides = buildSlides(moduleWith([lesson({ kind: 'EXAMPLE', heading: 'Ejemplos', body })]));
    const examples = slides.filter((s) => s.kind === 'example');
    expect(examples).toHaveLength(2);
    expect(examples[0].steps).toHaveLength(3);
    expect(examples[0].statement).toContain('zapatillas');
    expect(examples[1].heading).toContain('Ejemplo 2');
  });

  it('compat: una lección EXAMPLE sin estructura degrada a slides de contenido', () => {
    const slides = buildSlides(
      moduleWith([lesson({ kind: 'EXAMPLE', heading: 'Ejemplos', body: 'log(100) = 2 porque 10^2 = 100.' })]),
    );
    expect(slides.filter((s) => s.kind === 'example')).toHaveLength(0);
    const content = slides.filter((s) => s.kind === 'content');
    expect(content).toHaveLength(1);
    expect(content[0].blocks).toEqual(['log(100) = 2 porque 10^2 = 100.']);
  });
});

describe('fragmentCount', () => {
  it('en slides example cuenta enunciado + pasos + resultado + porqué', () => {
    const slides = buildSlides(
      moduleWith([lesson({ kind: 'EXAMPLE', heading: 'Ejemplos', body: EXAMPLE_MD })]),
    );
    const ex = slides.find((s) => s.kind === 'example')!;
    expect(fragmentCount(ex)).toBe(1 + 3 + 1 + 1);
  });

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
