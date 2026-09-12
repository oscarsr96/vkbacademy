import { buildStudyProfileLines, rankWeakTopics, type StudyProfile } from './study-profile';

describe('rankWeakTopics', () => {
  it('ordena por fallos y devuelve como mucho tres temas, con "N fallos de M"', () => {
    const attempts = [
      { topicLabel: 'Ecuaciones', verdict: 'incorrect' },
      { topicLabel: 'Ecuaciones', verdict: 'partial' },
      { topicLabel: 'Ecuaciones', verdict: 'correct' },
      { topicLabel: 'Fracciones', verdict: 'incorrect' },
      { topicLabel: 'Fracciones', verdict: 'correct' },
      { topicLabel: 'Fracciones', verdict: 'correct' },
      { topicLabel: 'Potencias', verdict: 'incorrect' },
      { topicLabel: 'Raíces', verdict: 'incorrect' },
      { topicLabel: 'Porcentajes', verdict: 'correct' },
    ];

    expect(rankWeakTopics(attempts)).toEqual([
      { topicLabel: 'Ecuaciones', failed: 2, total: 3 },
      { topicLabel: 'Fracciones', failed: 1, total: 3 },
      { topicLabel: 'Potencias', failed: 1, total: 1 },
    ]);
  });

  it('un tema sin fallos no cuenta como flojo', () => {
    expect(rankWeakTopics([{ topicLabel: 'Porcentajes', verdict: 'correct' }])).toEqual([]);
  });
});

describe('buildStudyProfileLines', () => {
  const full: StudyProfile = {
    schoolYear: '2º ESO',
    plans: [
      { title: 'Fracciones · Ecuaciones', course: 'Matemáticas' },
      { title: 'La célula', course: 'Biología' },
    ],
    weakTopics: [{ topicLabel: 'Ecuaciones', failed: 2, total: 3 }],
  };

  it('con datos, describe curso, planes y temas flojos para adaptar, no para reprochar', () => {
    const text = buildStudyProfileLines(full).join('\n');

    expect(text).toContain('El alumno está en 2º ESO.');
    expect(text).toContain('Fracciones · Ecuaciones (Matemáticas)');
    expect(text).toContain('La célula (Biología)');
    expect(text).toContain('Ecuaciones (2 fallos de 3)');
    expect(text).toMatch(/empieza por ahí|no se lo reproches/i);
  });

  it('sin ningún dato, no añade nada', () => {
    expect(buildStudyProfileLines({ schoolYear: null, plans: [], weakTopics: [] })).toEqual([]);
  });

  it('solo con curso, una línea', () => {
    expect(buildStudyProfileLines({ schoolYear: '1º Bachillerato', plans: [], weakTopics: [] })).toEqual([
      'El alumno está en 1º Bachillerato.',
    ]);
  });
});
