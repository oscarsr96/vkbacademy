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
import { AdminService } from './admin.service';
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

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly courseGeneratorService: CourseGeneratorService,
    private readonly billingService: BillingService,
    private readonly certificatesService: CertificatesService,
  ) {}

  @Get('users')
  getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.adminService.updateRole(id, dto.role);
  }

  @Patch('users/:id/tutor')
  assignTutor(@Param('id') id: string, @Body() dto: AssignTutorDto) {
    return this.adminService.assignTutor(id, dto.tutorId);
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // ─── Matrículas manuales ──────────────────────────────────────────────────

  @Get('users/:id/enrollments')
  getEnrollments(@Param('id') id: string) {
    return this.adminService.getEnrollments(id);
  }

  @Post('users/:id/enrollments')
  enroll(@Param('id') id: string, @Body() dto: EnrollUserDto) {
    return this.adminService.enroll(id, dto.courseId);
  }

  @Delete('users/:id/enrollments/:courseId')
  unenroll(@Param('id') id: string, @Param('courseId') courseId: string) {
    return this.adminService.unenroll(id, courseId);
  }

  @Get('metrics')
  getMetrics() {
    return this.adminService.getMetrics();
  }

  // ─── Facturación ──────────────────────────────────────────────────────────

  @Get('billing')
  getBilling(@Query() query: BillingQueryDto) {
    return this.billingService.getReport(query.from, query.to);
  }

  @Patch('billing/config')
  updateBillingConfig(@Body() dto: UpdateBillingConfigDto) {
    return this.billingService.updateConfig(dto);
  }

  @Get('analytics')
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.adminService.getAnalytics(query);
  }

  @Get('courses')
  listCourses(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('schoolYearId') schoolYearId?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listCourses({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      schoolYearId,
      search,
    });
  }

  // Debe declararse ANTES que DELETE /admin/courses/:id para evitar conflictos de rutas
  @Get('courses/:courseId/detail')
  getCourseDetail(@Param('courseId') courseId: string) {
    return this.adminService.getCourseDetail(courseId);
  }

  @Post('courses/generate')
  generateCourse(@Body() dto: GenerateCourseDto) {
    return this.courseGeneratorService.generateAndCreate(dto.name, dto.schoolYearId);
  }

  @Post('courses/import')
  importCourse(@Body() dto: ImportCourseDto) {
    return this.adminService.importCourse(dto);
  }

  @Delete('courses/:id')
  deleteCourse(@Param('id') id: string) {
    return this.adminService.deleteCourse(id);
  }

  // ─── Módulos ──────────────────────────────────────────────────────────────

  // Debe declararse ANTES que POST /admin/courses/:courseId/modules para evitar conflictos
  @Post('courses/:courseId/modules/generate')
  generateModule(@Param('courseId') courseId: string, @Body() dto: GenerateModuleDto) {
    return this.courseGeneratorService.generateAndCreateModule(courseId, dto.name);
  }

  @Post('courses/:courseId/modules')
  createModule(@Param('courseId') courseId: string, @Body() dto: CreateModuleDto) {
    return this.adminService.createModule(courseId, dto);
  }

  @Patch('modules/:moduleId')
  updateModule(@Param('moduleId') moduleId: string, @Body() dto: UpdateModuleDto) {
    return this.adminService.updateModule(moduleId, dto);
  }

  @Delete('modules/:moduleId')
  deleteModule(@Param('moduleId') moduleId: string) {
    return this.adminService.deleteModule(moduleId);
  }

  // ─── Lecciones ────────────────────────────────────────────────────────────

  // Debe declararse ANTES que POST /admin/modules/:moduleId/lessons
  @Post('modules/:moduleId/lessons/generate')
  generateLesson(@Param('moduleId') moduleId: string, @Body() dto: GenerateLessonDto) {
    return this.courseGeneratorService.generateAndCreateLesson(moduleId, dto.topic);
  }

  @Post('modules/:moduleId/lessons')
  createLesson(@Param('moduleId') moduleId: string, @Body() dto: CreateLessonDto) {
    return this.adminService.createLesson(moduleId, dto);
  }

  @Patch('lessons/:lessonId')
  updateLesson(@Param('lessonId') lessonId: string, @Body() dto: UpdateLessonDto) {
    return this.adminService.updateLesson(lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  deleteLesson(@Param('lessonId') lessonId: string) {
    return this.adminService.deleteLesson(lessonId);
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────

  @Post('lessons/:lessonId/quiz')
  initQuiz(@Param('lessonId') lessonId: string) {
    return this.adminService.initQuiz(lessonId);
  }

  // ─── Preguntas ────────────────────────────────────────────────────────────

  // Debe declararse ANTES que POST /admin/quizzes/:quizId/questions
  @Post('quizzes/:quizId/questions/generate')
  generateQuestion(@Param('quizId') quizId: string, @Body() dto: GenerateQuestionDto) {
    return this.courseGeneratorService.generateAndCreateQuestion(quizId, dto.topic);
  }

  @Post('quizzes/:quizId/questions')
  createQuestion(@Param('quizId') quizId: string, @Body() dto: CreateQuestionDto) {
    return this.adminService.createQuestion(quizId, dto);
  }

  @Patch('questions/:questionId')
  updateQuestion(@Param('questionId') questionId: string, @Body() dto: UpdateQuestionDto) {
    return this.adminService.updateQuestion(questionId, dto);
  }

  @Delete('questions/:questionId')
  deleteQuestion(@Param('questionId') questionId: string) {
    return this.adminService.deleteQuestion(questionId);
  }

  // ─── Canjes ───────────────────────────────────────────────────────────────

  @Get('redemptions')
  listRedemptions() {
    return this.adminService.listRedemptions();
  }

  @Patch('redemptions/:id/deliver')
  markRedemptionDelivered(@Param('id') id: string) {
    return this.adminService.markRedemptionDelivered(id);
  }

  // ─── Retos ────────────────────────────────────────────────────────────────

  @Get('challenges')
  listChallenges() {
    return this.adminService.listChallenges();
  }

  @Post('challenges')
  createChallenge(@Body() dto: CreateChallengeDto) {
    return this.adminService.createChallenge(dto);
  }

  @Patch('challenges/:challengeId')
  updateChallenge(@Param('challengeId') id: string, @Body() dto: UpdateChallengeDto) {
    return this.adminService.updateChallenge(id, dto);
  }

  @Delete('challenges/:challengeId')
  deleteChallenge(@Param('challengeId') id: string) {
    return this.adminService.deleteChallenge(id);
  }

  @Patch('challenges/:challengeId/toggle')
  toggleChallenge(@Param('challengeId') id: string) {
    return this.adminService.toggleChallenge(id);
  }

  // ─── Banco de preguntas de examen ──────────────────────────────────────────

  @Get('exam-questions')
  getExamQuestions(
    @Query('courseId') courseId?: string,
    @Query('moduleId') moduleId?: string,
  ) {
    return this.adminService.getExamQuestions(courseId, moduleId);
  }

  // Debe declararse ANTES que POST /admin/exam-questions para evitar conflictos de ruta
  @Post('exam-questions/import')
  importExamQuestions(@Body() dto: ImportExamQuestionsDto) {
    return this.adminService.importExamQuestions(dto);
  }

  @Post('exam-questions/generate')
  generateExamQuestions(@Body() dto: GenerateExamQuestionsDto) {
    return this.courseGeneratorService.generateExamQuestions(
      dto.topic,
      dto.count ?? 3,
      { courseId: dto.courseId, moduleId: dto.moduleId },
    );
  }

  @Post('exam-questions')
  createExamQuestion(@Body() dto: CreateExamQuestionDto) {
    return this.adminService.createExamQuestion(dto);
  }

  @Patch('exam-questions/:id')
  updateExamQuestion(@Param('id') id: string, @Body() dto: UpdateExamQuestionDto) {
    return this.adminService.updateExamQuestion(id, dto);
  }

  @Delete('exam-questions/:id')
  deleteExamQuestion(@Param('id') id: string) {
    return this.adminService.deleteExamQuestion(id);
  }

  @Get('exam-attempts')
  getExamAttempts(
    @Query('courseId') courseId?: string,
    @Query('moduleId') moduleId?: string,
  ) {
    return this.adminService.getExamAttempts(courseId, moduleId);
  }

  // ─── Certificados ─────────────────────────────────────────────────────────

  @Get('certificates')
  getAllCertificates() {
    return this.certificatesService.getAllCertificates();
  }

  @Post('certificates')
  issueCertificate(@Body() dto: IssueCertificateDto) {
    return this.certificatesService.issueManual(dto);
  }
}
