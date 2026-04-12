import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardia de regresión: el hero de AcademyLandingPage debe coincidir con
 * el de LandingPage (ambos usan "Metodología VKB para el rendimiento académico").
 *
 * Sin este test, es fácil que las dos landings diverjan y el usuario vea
 * un hero distinto según si la resolución de academia funciona o no.
 */
describe('AcademyLandingPage — hero text', () => {
  const filePath = path.resolve(__dirname, 'AcademyLandingPage.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('contiene el hero "Metodología" (no el antiguo "formación de tu club")', () => {
    expect(content).toMatch(/[Mm]etodología/);
    expect(content).not.toMatch(/formación de tu club/);
  });

  it('contiene "rendimiento académico" en el hero', () => {
    expect(content).toMatch(/rendimiento académico/i);
  });
});
