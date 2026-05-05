import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExamsService } from './exams.service';
import { AiExamsService } from './ai-exams.service';
import { StartExamDto } from './dto/start-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';
import { GenerateAiExamDto } from './dto/generate-ai-exam.dto';

@Controller('exams')
@UseGuards(JwtAuthGuard)
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly aiExamsService: AiExamsService,
  ) {}

  @Get('available')
  getAvailable(@CurrentUser() user: { id: string }) {
    return this.examsService.getAvailable(user.id);
  }

  @Get('info')
  getBankInfo(
    @Query('courseId') courseId?: string,
    @Query('moduleId') moduleId?: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.examsService.getBankInfo({ courseId, moduleId }, user!.id);
  }

  @Post('start')
  startExam(@Body() dto: StartExamDto, @CurrentUser() user: { id: string }) {
    return this.examsService.startExam(user.id, dto);
  }

  // ─── Exámenes generados por IA (alumno) ─────────────────────────────────
  // Las rutas /ai/* van ANTES de :attemptId/submit para que NestJS no las
  // confunda con un attemptId.

  @Post('ai/generate')
  generateAiExam(@Body() dto: GenerateAiExamDto, @CurrentUser() user: { id: string }) {
    return this.aiExamsService.generate(user.id, dto);
  }

  @Get('ai/my-banks')
  listMyAiBanks(@CurrentUser() user: { id: string }) {
    return this.aiExamsService.listMyBanks(user.id);
  }

  @Get('ai/:bankId')
  getAiBank(@Param('bankId') bankId: string, @CurrentUser() user: { id: string }) {
    return this.aiExamsService.getBank(user.id, bankId);
  }

  @Delete('ai/:bankId')
  deleteAiBank(@Param('bankId') bankId: string, @CurrentUser() user: { id: string }) {
    return this.aiExamsService.deleteBank(user.id, bankId);
  }

  @Post('ai/:bankId/start')
  startAiAttempt(@Param('bankId') bankId: string, @CurrentUser() user: { id: string }) {
    return this.aiExamsService.startAttempt(user.id, bankId);
  }

  @Post(':attemptId/submit')
  submitExam(
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitExamDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.examsService.submitExam(attemptId, user.id, dto);
  }

  @Get('history')
  getHistory(
    @Query('courseId') courseId?: string,
    @Query('moduleId') moduleId?: string,
    @CurrentUser() user?: { id: string },
  ) {
    return this.examsService.getHistory({ courseId, moduleId }, user!.id);
  }
}
