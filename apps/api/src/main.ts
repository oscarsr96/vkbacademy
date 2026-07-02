import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (Helmet)
  app.use(helmet());

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

  // CORS: la lista blanca sale EXCLUSIVAMENTE de FRONTEND_URL (múltiples orígenes
  // separados por coma). Los dominios reales de PRE/PROD se inyectan por env en
  // Render. En desarrollo se admite además localhost aunque no esté en la env.
  const isProduction = process.env.NODE_ENV === 'production';
  const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requests sin Origin (Postman, apps móviles nativas)
      if (!origin) return callback(null, true);
      // Permite orígenes explícitos en FRONTEND_URL
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Solo en desarrollo: cualquier puerto de localhost/127.0.0.1
      if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 API corriendo en: http://localhost:${port}/api`);
}

bootstrap();
