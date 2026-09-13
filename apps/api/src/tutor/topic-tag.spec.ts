import { TopicTagFilter, buildCurriculumLines, type CurriculumTopic } from './topic-tag';

/** Pasa los trozos por el filtro y devuelve lo que habría visto el alumno. */
function run(chunks: string[]): { seen: string; index: number | null } {
  const f = new TopicTagFilter();
  let seen = '';
  for (const c of chunks) seen += f.push(c);
  seen += f.flush();
  return { seen, index: f.topicIndex };
}

describe('TopicTagFilter (#144)', () => {
  it('quita la etiqueta de la primera línea y la línea en blanco que la sigue', () => {
    const { seen, index } = run(['TEMA: 3\n\nLas fracciones', ' se suman así.']);
    expect(index).toBe(3);
    expect(seen).toBe('Las fracciones se suman así.');
  });

  it('funciona aunque la etiqueta llegue partida en varios trozos', () => {
    const { seen, index } = run(['TE', 'MA: 1', '2\n', 'Hola']);
    expect(index).toBe(12);
    expect(seen).toBe('Hola');
  });

  it('la línea en blanco tras la etiqueta puede llegar en el trozo siguiente', () => {
    const { seen, index } = run(['TEMA: 3\n', '\n', 'Hola']);
    expect(index).toBe(3);
    expect(seen).toBe('Hola');
  });

  it('TEMA: 0 significa ningún tema', () => {
    const { seen, index } = run(['TEMA: 0\n\nNo es del temario.']);
    expect(index).toBe(0);
    expect(seen).toBe('No es del temario.');
  });

  it('tolera negrita o espacios alrededor', () => {
    expect(run(['**TEMA: 7**\n\nHola']).index).toBe(7);
    expect(run(['  tema:  7  \nHola']).index).toBe(7);
  });

  it('sin etiqueta, deja pasar el texto tal cual, incluida la primera línea', () => {
    const { seen, index } = run(['Hola, ', 'veo una ecuación.\nSegunda línea.']);
    expect(index).toBeNull();
    expect(seen).toBe('Hola, veo una ecuación.\nSegunda línea.');
  });

  it('si la primera línea es muy larga sin salto, decide que no hay etiqueta y suelta lo retenido', () => {
    const long = 'x'.repeat(60);
    const f = new TopicTagFilter();
    // Mientras dura la duda no se emite nada; al pasar el límite, todo
    const first = f.push('Hola ');
    expect(first).toBe('');
    expect(f.push(long)).toBe('Hola ' + long);
    expect(f.topicIndex).toBeNull();
  });

  it('respuesta que termina sin salto de línea: flush suelta lo retenido', () => {
    const { seen, index } = run(['Sí.']);
    expect(index).toBeNull();
    expect(seen).toBe('Sí.');
  });
});

describe('buildCurriculumLines (#144)', () => {
  const topics: CurriculumTopic[] = [
    { index: 1, title: 'Números racionales y reales', courseId: 'c-mat', courseTitle: 'Matemáticas 3º ESO', moduleId: 'm-1' },
    { index: 2, title: 'La célula', courseId: 'c-bio', courseTitle: 'Biología 3º ESO', moduleId: 'm-2' },
  ];

  it('numera el temario y explica la etiqueta', () => {
    const text = buildCurriculumLines(topics).join('\n');
    expect(text).toContain('1. Matemáticas 3º ESO — Números racionales y reales');
    expect(text).toContain('2. Biología 3º ESO — La célula');
    expect(text).toMatch(/primera línea.*TEMA: <n>/i);
    expect(text).toContain('TEMA: 0');
  });

  it('sin temario, nada', () => {
    expect(buildCurriculumLines([])).toEqual([]);
  });
});
