import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminContentService } from './admin-content.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminGamificationService } from './admin-gamification.service';
import { AdminExamsService } from './admin-exams.service';
import { CourseGeneratorService } from './course-generator.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { GenerateCourseDto } from './dto/generate-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/create-question.dto';
import { GenerateModuleDto } from './dto/generate-module.dto';
import { GenerateLessonDto } from './dto/generate-lesson.dto';
import { GenerateQuestionDto } from './dto/generate-question.dto';
import { AssignTutorDto } from './dto/assign-tutor.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { BillingQueryDto } from './dto/billing-query.dto';
import { UpdateBillingConfigDto } from './dto/update-billing-config.dto';
import { BillingService } from './billing.service';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { CreateExamQuestionDto, UpdateExamQuestionDto } from './dto/create-exam-question.dto';
import { GenerateExamQuestionsDto } from './dto/generate-exam-questions.dto';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { EnrollUserDto } from './dto/enroll-user.dto';
import { ImportCourseDto } from './dto/import-course.dto';
import { ImportExamQuestionsDto } from './dto/import-exam-questions.dto';
import { CertificatesService } from '../certificates/certificates.service';
import { AcademyGuard } from '../auth/guards/academy.guard';
import { CurrentAcademy } from '../auth/decorators/current-academy.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, AcademyGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminContentService: AdminContentService,
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminGamificationService: AdminGamificationService,
    private readonly adminExamsService: AdminExamsService,
    private readonly courseGeneratorService: CourseGeneratorService,
    private readonly billingService: BillingService,
    private readonly certificatesService: CertificatesService,
  ) {}

  @Get('users')
  getUsers(
    @CurrentAcademy() academyId: string | null,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('role') role?: Role,
  ) {
    return this.adminUsersService.getUsers(academyId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      role,
    });
  }

  @Patch('users/:id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminUsersService.updateRole(id, dto.role);
  }

  @Patch('users/:id/tutor')
  assignTutor(@Param('id') id: string, @Body() dto: AssignTutorDto) {
    return this.adminUsersService.assignTutor(id, dto.tutorId);
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto, @CurrentAcademy() academyId: string | null) {
    return this.adminUsersService.createUser(dto, academyId);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminUsersService.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminUsersService.deleteUser(id);
  }

  // ─── Matrículas manuales ──────────────────────────────────────────────────

  @Get('users/:id/enrollments')
  getEnrollments(@Param('id') id: string) {
    return this.adminUsersService.getEnrollments(id);
  }

  @Post('users/:id/enrollments')
  enroll(@Param('id') id: string, @Body() dto: EnrollUserDto) {
    return this.adminUsersService.enroll(id, dto.courseId);
  }

  @Delete('users/:id/enrollments/:courseId')
  unenroll(@Param('id') id: string, @Param('courseId') courseId: string) {
    return this.adminUsersService.unenroll(id, courseId);
  }

  @Get('metrics')
  getMetrics() {
    return this.adminAnalyticsService.getMetrics();
  }

  // ─── Facturación ──────────────────────────────────────────────────────────

  @Get('billing')
  getBilling(@Query() query: BillingQueryDto, @CurrentAcademy() academyId: string | null) {
    return this.billingService.getReport(query.from, query.to, academyId);
  }

  @Patch('billing/config')
  updateBillingConfig(
    @Body() dto: UpdateBillingConfigDto,
    @CurrentAcademy() academyId: string | null,
  ) {
    return this.billingService.updateConfig(dto, academyId);
  }

  @Get('analytics')
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminAnalyticsService.getAnalytics(query);
  }

  @Get('courses')
  listCourses(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('schoolYearId') schoolYearId?: string,
    @Query('search') search?: string,
  ) {
    return this.adminContentService.listCourses({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      schoolYearId,
      search,
    });
  }

  // Debe declararse ANTES que DELETE /admin/courses/:id para evitar conflictos de rutas
  @Get('courses/:courseId/detail')
  getCourseDetail(@Param('courseId') courseId: string) {
    return this.adminContentService.getCourseDetail(courseId);
  }

  @Post('courses/generate')
  generateCourse(@Body() dto: GenerateCourseDto) {
    return this.courseGeneratorService.generateAndCreate(dto.name, dto.schoolYearId);
  }

  @Post('courses/import')
  importCourse(@Body() dto: ImportCourseDto) {
    return this.adminContentService.importCourse(dto);
  }

  @Delete('courses/:id')
  deleteCourse(@Param('id') id: string) {
    return this.adminContentService.deleteCourse(id);
  }

  // ─── Módulos ──────────────────────────────────────────────────────────────

  // Debe declararse ANTES que POST /admin/courses/:courseId/modules para evitar conflictos
  @Post('courses/:courseId/modules/generate')
  generateModule(@Param('courseId') courseId: string, @Body() dto: GenerateModuleDto) {
    return this.courseGeneratorService.generateAndCreateModule(courseId, dto.name);
  }

  @Post('courses/:courseId/modules')
  createModule(@Param('courseId') courseId: string, @Body() dto: CreateModuleDto) {
    return this.adminContentService.createModule(courseId, dto);
  }

  @Patch('modules/:moduleId')
  updateModule(@Param('moduleId') moduleId: string, @Body() dto: UpdateModuleDto) {
    return this.adminContentService.updateModule(moduleId, dto);
  }

  @Delete('modules/:moduleId')
  deleteModule(@Param('moduleId') moduleId: string) {
    return this.adminContentService.deleteModule(moduleId);
  }

  // ─── Lecciones ────────────────────────────────────────────────────────────

  // Debe declararse ANTES que POST /admin/modules/:moduleId/lessons
  @Post('modules/:moduleId/lessons/generate')
  generateLesson(@Param('moduleId') moduleId: string, @Body() dto: GenerateLessonDto) {
    return this.courseGeneratorService.generateAndCreateLesson(moduleId, dto.topic);
  }

  @Post('modules/:moduleId/lessons')
  createLesson(@Param('moduleId') moduleId: string, @Body() dto: CreateLessonDto) {
    return this.adminContentService.createLesson(moduleId, dto);
  }

  @Patch('lessons/:lessonId')
  updateLesson(@Param('lessonId') lessonId: string, @Body() dto: UpdateLessonDto) {
    return this.adminContentService.updateLesson(lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  deleteLesson(@Param('lessonId') lessonId: string) {
    return this.adminContentService.deleteLesson(lessonId);
  }

  @Get('lessons/:lessonId/youtube-candidates')
  getYoutubeCandidates(@Param('lessonId') lessonId: string, @Query('exclude') exclude?: string) {
    const excludeIds = exclude ? exclude.split(',').filter(Boolean) : [];
    return this.adminContentService.getYoutubeCandidates(lessonId, excludeIds);
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────

  @Post('lessons/:lessonId/quiz')
  initQuiz(@Param('lessonId') lessonId: string) {
    return this.adminContentService.initQuiz(lessonId);
  }

  // ─── Preguntas ────────────────────────────────────────────────────────────

  // Debe declararse ANTES que POST /admin/quizzes/:quizId/questions
  @Post('quizzes/:quizId/questions/generate')
  generateQuestion(@Param('quizId') quizId: string, @Body() dto: GenerateQuestionDto) {
    return this.courseGeneratorService.generateAndCreateQuestion(quizId, dto.topic);
  }

  @Post('quizzes/:quizId/questions')
  createQuestion(@Param('quizId') quizId: string, @Body() dto: CreateQuestionDto) {
    return this.adminContentService.createQuestion(quizId, dto);
  }

  @Patch('questions/:questionId')
  updateQuestion(@Param('questionId') questionId: string, @Body() dto: UpdateQuestionDto) {
    return this.adminContentService.updateQuestion(questionId, dto);
  }

  @Delete('questions/:questionId')
  deleteQuestion(@Param('questionId') questionId: string) {
    return this.adminContentService.deleteQuestion(questionId);
  }

  // ─── Canjes ───────────────────────────────────────────────────────────────

  @Get('redemptions')
  listRedemptions(
    @CurrentAcademy() academyId: string | null,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminGamificationService.listRedemptions(academyId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Patch('redemptions/:id/deliver')
  markRedemptionDelivered(@Param('id') id: string) {
    return this.adminGamificationService.markRedemptionDelivered(id);
  }

  // ─── Retos ────────────────────────────────────────────────────────────────

  @Get('challenges')
  listChallenges(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminGamificationService.listChallenges({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('challenges')
  createChallenge(@Body() dto: CreateChallengeDto) {
    return this.adminGamificationService.createChallenge(dto);
  }

  @Patch('challenges/:challengeId')
  updateChallenge(@Param('challengeId') id: string, @Body() dto: UpdateChallengeDto) {
    return this.adminGamificationService.updateChallenge(id, dto);
  }

  @Delete('challenges/:challengeId')
  deleteChallenge(@Param('challengeId') id: string) {
    return this.adminGamificationService.deleteChallenge(id);
  }

  @Patch('challenges/:challengeId/toggle')
  toggleChallenge(@Param('challengeId') id: string) {
    return this.adminGamificationService.toggleChallenge(id);
  }

  // ─── Banco de preguntas de examen ──────────────────────────────────────────

  @Get('exam-questions')
  getExamQuestions(@Query('courseId') courseId?: string, @Query('moduleId') moduleId?: string) {
    return this.adminExamsService.getExamQuestions(courseId, moduleId);
  }

  // Debe declararse ANTES que POST /admin/exam-questions para evitar conflictos de ruta
  @Post('exam-questions/import')
  importExamQuestions(@Body() dto: ImportExamQuestionsDto) {
    return this.adminExamsService.importExamQuestions(dto);
  }

  @Post('exam-questions/generate')
  generateExamQuestions(@Body() dto: GenerateExamQuestionsDto) {
    return this.courseGeneratorService.generateExamQuestions(dto.topic, dto.count ?? 3, {
      courseId: dto.courseId,
      moduleId: dto.moduleId,
    });
  }

  @Post('exam-questions')
  createExamQuestion(@Body() dto: CreateExamQuestionDto) {
    return this.adminExamsService.createExamQuestion(dto);
  }

  @Patch('exam-questions/:id')
  updateExamQuestion(@Param('id') id: string, @Body() dto: UpdateExamQuestionDto) {
    return this.adminExamsService.updateExamQuestion(id, dto);
  }

  @Delete('exam-questions/:id')
  deleteExamQuestion(@Param('id') id: string) {
    return this.adminExamsService.deleteExamQuestion(id);
  }

  @Get('exam-attempts')
  getExamAttempts(
    @Query('courseId') courseId?: string,
    @Query('moduleId') moduleId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminExamsService.getExamAttempts(courseId, moduleId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  // ─── Certificados ─────────────────────────────────────────────────────────

  @Get('certificates')
  getAllCertificates(@Query('page') page = '1', @Query('limit') limit = '10') {
    return this.certificatesService.getAllCertificates({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('certificates')
  issueCertificate(@Body() dto: IssueCertificateDto) {
    return this.certificatesService.issueManual(dto);
  }
}
