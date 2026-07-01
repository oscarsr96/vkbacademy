import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TheoryModule } from '../theory/theory.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { ExamsModule } from '../exams/exams.module';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

@Module({
  imports: [PrismaModule, TheoryModule, ExercisesModule, ExamsModule],
  controllers: [StudyController],
  providers: [StudyService],
})
export class StudyModule {}
