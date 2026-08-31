/**
 * Envío del resumen semanal a las familias suscritas.
 *
 * Lo lanza `.github/workflows/weekly-digest.yml`. La lógica vive en
 * `GuardianDigestService`, dentro de la API, para poder testearla con Jest;
 * aquí solo se arranca un contexto de Nest y se llama.
 *
 * Uso local:
 *   npx ts-node scripts/send-weekly-digest.ts --dry-run
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GuardianDigestService } from '../src/guardians/guardian-digest.service';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  try {
    const result = await app.get(GuardianDigestService).sendWeeklyDigests({ dryRun });
    console.log(
      `Resumen semanal: ${result.sent} enviados, ${result.skipped} saltados` +
        (dryRun ? ' (dry-run: no se ha enviado nada)' : ''),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
