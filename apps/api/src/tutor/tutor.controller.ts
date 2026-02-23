import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TutorChatDto } from './dto/tutor-chat.dto';
import { TutorService } from './tutor.service';

@Controller('tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  // 10 preguntas por hora por usuario (~$0.24/alumno en uso moderado)
  @Post('chat')
  @Throttle({ default: { ttl: 3600000, limit: 10 } })
  chat(
    @Request() req: { user: { id: string } },
    @Body() dto: TutorChatDto,
    @Res() res: Response,
  ) {
    return this.tutorService.streamChat(req.user.id, dto, res);
  }

  @Get('history')
  getHistory(@Request() req: { user: { id: string } }) {
    return this.tutorService.getHistory(req.user.id);
  }

  @Delete('history')
  clearHistory(@Request() req: { user: { id: string } }) {
    return this.tutorService.clearHistory(req.user.id);
  }
}
