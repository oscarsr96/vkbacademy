import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExamsService } from './exams.service';
import { StartExamDto } from './dto/start-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

@Controller('exams')
@UseGuards(JwtAuthGuard)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

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
