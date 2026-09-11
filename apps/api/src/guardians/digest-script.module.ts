import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { GuardiansModule } from './guardians.module';
import { digestEnvValidationSchema } from './digest-script.env';

/**
 * Contexto mínimo para `scripts/send-weekly-digest.ts`.
 *
 * No usa `AppModule` a propósito: arrancaría throttler, auth, IA, etc. y
 * exigiría todo `envValidationSchema` (incluidos los secretos JWT) para una
 * tarea que solo lee la BD y manda correos.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: digestEnvValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    PrismaModule,
    GuardiansModule,
  ],
})
export class DigestScriptModule {}
