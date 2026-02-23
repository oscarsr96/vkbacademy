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

  // 15 preguntas por minuto por usuario (más restrictivo que el global de 100)
  @Post('chat')
  @Throttle({ default: { ttl: 60000, limit: 15 } })
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
