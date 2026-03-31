import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global de la API
  app.setGlobalPrefix('api');

  // Validación automática de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Elimina campos no declarados en el DTO
      forbidNonWhitelisted: true,
      transform: true,         // Transforma tipos automáticamente (e.g., string → number)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS: soporta múltiples orígenes separados por coma (producción + previews de PR)
  const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requests sin Origin (Postman, apps móviles nativas)
      if (!origin) return callback(null, true);
      // Permite orígenes explícitos en FRONTEND_URL
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Permite cualquier subdominio de vercel.app (para N academias)
      if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);

      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 API corriendo en: http://localhost:${port}/api`);
}

bootstrap();
