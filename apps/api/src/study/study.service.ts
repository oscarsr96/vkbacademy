import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TheoryService } from '../theory/theory.service';
import { ExercisesService, GeneratedExercise } from '../exercises/exercises.service';
import { AiExamsService } from '../exams/ai-exams.service';
import { CreateStudyUnitDto } from './dto/create-study-unit.dto';
import { RegenerateExercisesDto } from './dto/regenerate-exercises.dto';
import { RegenerateExamDto } from './dto/regenerate-exam.dto';

/**
 * Orquesta la creación de unidades de estudio: a partir de una asignatura y un
 * tema genera Teoría + Ejercicios + Examen (reutilizando los servicios IA
 * existentes) y los agrupa en una StudyUnit personal (scoped por userId).
 */
@Injectable()
export class StudyService {
  private readonly logger = new Logger(StudyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly theory: TheoryService,
    private readonly exercises: ExercisesService,
    private readonly aiExams: AiExamsService,
  ) {}

  private async assertEnrolled(userId: string, courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException(`Curso "${courseId}" no encontrado`);
    const enrollment = await this.prisma.enrollment.findFirst({ where: { userId, courseId } });
    if (!enrollment) throw new ForbiddenException('No estás matriculado en este curso');
  }

  async create(userId: string, dto: CreateStudyUnitDto) {
    await this.assertEnrolled(userId, dto.courseId);

    // Unidad "cáscara": título/summary provisionales, se completan desde la teoría.
    const unit = await this.prisma.studyUnit.create({
      data: { userId, courseId: dto.courseId, topic: dto.topic, title: dto.topic, summary: '' },
    });

    // Las 3 secciones a la vez. allSettled: una que falle no tumba las demás.
    const [theoryRes, exercisesRes, examRes] = await Promise.allSettled([
      this.theory.generate(userId, { courseId: dto.courseId, topic: dto.topic }),
      this.exercises.generate(userId, {
        courseId: dto.courseId,
        topic: dto.topic,
        count: dto.numExercises,
      }),
      this.aiExams.generate(userId, {
        courseId: dto.courseId,
        topic: dto.topic,
        numQuestions: dto.numQuestions,
        timeLimit: dto.timeLimit,
        onlyOnce: dto.onlyOnce,
      }),
    ]);

    if (
      theoryRes.status === 'rejected' &&
      exercisesRes.status === 'rejected' &&
      examRes.status === 'rejected'
    ) {
      this.logger.error('Las 3 secciones fallaron al generar la unidad de estudio');
      await this.prisma.studyUnit.delete({ where: { id: unit.id } });
      throw new InternalServerErrorException(
        'No se pudo generar ninguna sección. Inténtalo de nuevo en unos segundos.',
      );
    }

    const data: Prisma.StudyUnitUpdateInput = {};
    if (theoryRes.status === 'fulfilled') {
      await this.prisma.theoryModule.update({
        where: { id: theoryRes.value.id },
        data: { studyUnitId: unit.id },
      });
      data.title = theoryRes.value.title;
      data.summary = theoryRes.value.summary;
    }
    if (exercisesRes.status === 'fulfilled') {
      data.exercises = exercisesRes.value.exercises as unknown as Prisma.InputJsonValue;
    }
    if (examRes.status === 'fulfilled') {
      await this.prisma.aiExamBank.update({
        where: { id: examRes.value.id },
        data: { studyUnitId: unit.id },
      });
    }
    await this.prisma.studyUnit.update({ where: { id: unit.id }, data });

    return this.getById(userId, unit.id);
  }

  async listMine(userId: string) {
    const units = await this.prisma.studyUnit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        course: { select: { id: true, title: true } },
        theoryModule: { select: { id: true } },
        examBank: { select: { id: true } },
      },
    });
    return units.map((u) => ({
      id: u.id,
      topic: u.topic,
      title: u.title,
      summary: u.summary,
      createdAt: u.createdAt.toISOString(),
      course: u.course,
      sections: {
        theory: !!u.theoryModule,
        exercises: Array.isArray(u.exercises) && (u.exercises as unknown[]).length > 0,
        exam: !!u.examBank,
      },
    }));
  }

  async getById(userId: string, id: string) {
    const unit = await this.prisma.studyUnit.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, title: true } },
        theoryModule: { select: { id: true } },
        examBank: { select: { id: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unidad de estudio no encontrada');
    if (unit.userId !== userId) throw new ForbiddenException('No tienes acceso a esta unidad');

    const theory = unit.theoryModule
      ? await this.theory.getById(userId, unit.theoryModule.id)
      : null;
    const exam = unit.examBank ? await this.aiExams.getBank(userId, unit.examBank.id) : null;
    const exercises = Array.isArray(unit.exercises)
      ? (unit.exercises as unknown as GeneratedExercise[])
      : null;

    return {
      id: unit.id,
      topic: unit.topic,
      title: unit.title,
      summary: unit.summary,
      createdAt: unit.createdAt.toISOString(),
      course: unit.course,
      sections: {
        theory: !!theory,
        exercises: !!exercises && exercises.length > 0,
        exam: !!exam,
      },
      theory,
      exercises,
      exam,
    };
  }

  async deleteById(userId: string, id: string): Promise<void> {
    const unit = await this.prisma.studyUnit.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!unit) throw new NotFoundException('Unidad de estudio no encontrada');
    if (unit.userId !== userId) throw new ForbiddenException('No tienes acceso a esta unidad');
    await this.prisma.studyUnit.delete({ where: { id } });
  }

  // ── Regeneración por sección (para reintentar tras un fallo de IA) ──

  async regenerateTheory(userId: string, id: string) {
    const unit = await this.requireOwnedUnit(userId, id);
    if (unit.theoryModule) await this.theory.deleteById(userId, unit.theoryModule.id);
    const theory = await this.theory.generate(userId, {
      courseId: unit.courseId,
      topic: unit.topic,
    });
    await this.prisma.theoryModule.update({
      where: { id: theory.id },
      data: { studyUnitId: unit.id },
    });
    await this.prisma.studyUnit.update({
      where: { id: unit.id },
      data: { title: theory.title, summary: theory.summary },
    });
    return this.getById(userId, id);
  }

  async regenerateExercises(userId: string, id: string, dto: RegenerateExercisesDto) {
    const unit = await this.requireOwnedUnit(userId, id);
    const prevCount = Array.isArray(unit.exercises) ? (unit.exercises as unknown[]).length : 0;
    const count = dto.count ?? (prevCount > 0 ? prevCount : 5);
    const res = await this.exercises.generate(userId, {
      courseId: unit.courseId,
      topic: unit.topic,
      count,
    });
    await this.prisma.studyUnit.update({
      where: { id: unit.id },
      data: { exercises: res.exercises as unknown as Prisma.InputJsonValue },
    });
    return this.getById(userId, id);
  }

  async regenerateExam(userId: string, id: string, dto: RegenerateExamDto) {
    const unit = await this.requireOwnedUnit(userId, id);
    if (unit.examBank) await this.aiExams.deleteBank(userId, unit.examBank.id);
    const bank = await this.aiExams.generate(userId, {
      courseId: unit.courseId,
      topic: unit.topic,
      numQuestions: dto.numQuestions ?? 5,
      timeLimit: dto.timeLimit,
      onlyOnce: dto.onlyOnce,
    });
    await this.prisma.aiExamBank.update({
      where: { id: bank.id },
      data: { studyUnitId: unit.id },
    });
    return this.getById(userId, id);
  }

  private async requireOwnedUnit(userId: string, id: string) {
    const unit = await this.prisma.studyUnit.findUnique({
      where: { id },
      include: {
        theoryModule: { select: { id: true } },
        examBank: { select: { id: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unidad de estudio no encontrada');
    if (unit.userId !== userId) throw new ForbiddenException('No tienes acceso a esta unidad');
    return unit;
  }
}
