import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TheoryModule } from '../theory/theory.module';
import { ExercisesModule } from '../exercises/exercises.module';
import { ExamsModule } from '../exams/exams.module';
import { StudyPlansController } from './study-plans.controller';
import { StudyPlansService } from './study-plans.service';

@Module({
  imports: [PrismaModule, TheoryModule, ExercisesModule, ExamsModule],
  controllers: [StudyPlansController],
  providers: [StudyPlansService],
})
export class StudyPlansModule {}
