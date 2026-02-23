import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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

@Module({
  imports: [
    // Variables de entorno disponibles en toda la app
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting global
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto
      },
    ]),

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
  ],
})
export class AppModule {}
