import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardia de regresión sobre el Dockerfile.
 *
 * Asegura que las migraciones de Prisma NO se ejecutan dentro del `CMD`
 * del contenedor. Si alguien lo vuelve a meter, este test falla con un
 * mensaje explicando el motivo.
 *
 * Contexto: a partir de Fase B (ECS Fargate, >1 task) ejecutar
 * `prisma migrate deploy` desde el CMD provoca race conditions cuando
 * varias instancias arrancan a la vez. Las migraciones deben correr en
 * un step dedicado del pipeline, NO en el contenedor.
 *
 * Ver `.github/workflows/deploy-pipeline.yml` → jobs `migrate-pre` /
 * `migrate-prod`.
 */
describe('Dockerfile', () => {
  const dockerfilePath = path.resolve(__dirname, '../../Dockerfile');
  const content = fs.readFileSync(dockerfilePath, 'utf-8');
  const cmdLine = content.split('\n').find((line) => line.trim().startsWith('CMD ')) ?? '';

  it('tiene un CMD definido', () => {
    expect(cmdLine).not.toBe('');
  });

  it('el CMD NO ejecuta `prisma migrate deploy`', () => {
    expect(cmdLine).not.toMatch(/prisma\s+migrate\s+deploy/);
  });

  it('el CMD arranca el proceso Node directamente', () => {
    // Acepta tanto `CMD ["node", "dist/main"]` (exec form) como
    // `CMD node dist/main` (shell form).
    expect(cmdLine).toMatch(/node[^a-zA-Z]+dist\/main/);
  });
});
