import { parseDurationISO8601 } from './duration';

describe('parseDurationISO8601', () => {
  it('parsea duración con horas, minutos y segundos', () => {
    expect(parseDurationISO8601('PT1H2M30S')).toBe(3600 + 120 + 30);
  });

  it('parsea duración solo con minutos y segundos', () => {
    expect(parseDurationISO8601('PT15M30S')).toBe(15 * 60 + 30);
  });

  it('parsea duración solo con segundos', () => {
    expect(parseDurationISO8601('PT45S')).toBe(45);
  });

  it('parsea duración solo con minutos', () => {
    expect(parseDurationISO8601('PT12M')).toBe(12 * 60);
  });

  it('parsea duración solo con horas', () => {
    expect(parseDurationISO8601('PT2H')).toBe(2 * 3600);
  });

  it('devuelve 0 para duración vacía o inválida', () => {
    expect(parseDurationISO8601('')).toBe(0);
    expect(parseDurationISO8601('invalid')).toBe(0);
    expect(parseDurationISO8601('P1D')).toBe(0);
  });
});
