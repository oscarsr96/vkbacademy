import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProgressService } from './progress.service';
import { User } from '@prisma/client';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // Declarado ANTES de :id para que "recent" no sea capturado como parámetro
  @Get('recent')
  recentLessons(@CurrentUser() user: User) {
    return this.progressService.recentLessons(user.id);
  }

  @Get(':id')
  findOne(@Param('id') lessonId: string, @CurrentUser() user: User) {
    return this.progressService.findLesson(lessonId, user.id);
  }

  @Post(':id/complete')
  complete(@Param('id') lessonId: string, @CurrentUser() user: User) {
    return this.progressService.completeLesson(lessonId, user.id);
  }
}
