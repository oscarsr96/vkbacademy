import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.schema';
import { buildThrottlerOptions } from './config/throttler-options.factory';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { ProgressModule } from './progress/progress.module';
import { BookingsModule } from './bookings/bookings.module';
import { AvailabilityModule } from './availability/availability.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { SchoolYearsModule } from './school-years/school-years.module';
import { TutorsModule } from './tutors/tutors.module';
import { ChallengesModule } from './challenges/challenges.module';
import { ExamsModule } from './exams/exams.module';
import { CertificatesModule } from './certificates/certificates.module';
import { TutorModule } from './tutor/tutor.module';
import { AcademiesModule } from './academies/academies.module';
import { HealthModule } from './health/health.module';
import { AiModule } from './ai/ai.module';
import { ExercisesModule } from './exercises/exercises.module';

@Module({
  imports: [
    // Variables de entorno disponibles en toda la app
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),

    // Rate limiting global — usa Redis si REDIS_URL está definido (PRE/PROD),
    // in-memory en dev local. Ver `config/throttler-options.factory.ts`.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildThrottlerOptions(config),
    }),

    // Base de datos
    PrismaModule,

    // Módulos de dominio
    AuthModule,
    UsersModule,
    CoursesModule,
    QuizzesModule,
    ProgressModule,
    BookingsModule,
    AvailabilityModule,
    MediaModule,
    NotificationsModule,
    AdminModule,
    SchoolYearsModule,
    TutorsModule,
    ChallengesModule,
    ExamsModule,
    CertificatesModule,
    TutorModule,
    AcademiesModule,
    HealthModule,
    AiModule,
    ExercisesModule,
  ],
  providers: [
    // Rate limiting global (100 req/min por defecto)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
