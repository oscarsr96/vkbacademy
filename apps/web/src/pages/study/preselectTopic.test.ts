import { describe, expect, it } from 'vitest';
import { topicFromSearchParams } from './preselectTopic';

const modules = [
  { id: 'm-1', title: 'Fracciones' },
  { id: 'm-2', title: 'Ecuaciones' },
];

describe('topicFromSearchParams (#141)', () => {
  it('con moduleId del temario, tema oficial con su numeral', () => {
    const params = new URLSearchParams({ topic: 'Ecuaciones', moduleId: 'm-2' });
    expect(topicFromSearchParams(params, modules)).toEqual({
      key: 'official-m-2',
      kind: 'OFFICIAL',
      moduleId: 'm-2',
      title: 'Ecuaciones',
      label: 'Tema 2 — Ecuaciones',
    });
  });

  it('con moduleId que no está en este temario, tema propio con el título', () => {
    const params = new URLSearchParams({ topic: 'Raíces', moduleId: 'm-99' });
    expect(topicFromSearchParams(params, modules)).toMatchObject({
      kind: 'CUSTOM',
      title: 'Raíces',
      label: 'Raíces',
    });
  });

  it('solo con topic, tema propio', () => {
    expect(topicFromSearchParams(new URLSearchParams({ topic: 'Potencias' }), modules)).toMatchObject({
      kind: 'CUSTOM',
      title: 'Potencias',
    });
  });

  it('sin topic, o demasiado corto, nada', () => {
    expect(topicFromSearchParams(new URLSearchParams(), modules)).toBeNull();
    expect(topicFromSearchParams(new URLSearchParams({ topic: 'ab' }), modules)).toBeNull();
  });
});
