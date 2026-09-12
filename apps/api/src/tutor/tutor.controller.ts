import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Request,
  Res,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TutorChatDto } from './dto/tutor-chat.dto';
import { TutorImageTooLargeFilter, tutorImageMulterOptions } from './tutor-image.options';
import { TutorImage, TutorImageMimeType, TutorService } from './tutor.service';

@Controller('tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  // 10 preguntas por hora por usuario (~$0.24/alumno en uso moderado).
  // Acepta JSON (solo texto) o multipart con un fichero `image` opcional; el
  // interceptor no interfiere si la request no es multipart.
  @Post('chat')
  @Throttle({ default: { ttl: 3600000, limit: 10 } })
  @UseInterceptors(FileInterceptor('image', tutorImageMulterOptions))
  @UseFilters(TutorImageTooLargeFilter)
  chat(
    @Request() req: { user: { id: string } },
    @Body() dto: TutorChatDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Res() res: Response,
  ) {
    // El fileFilter ya ha dejado pasar solo los mime permitidos.
    const image: TutorImage | undefined = file
      ? { buffer: file.buffer, mimeType: file.mimetype as TutorImageMimeType }
      : undefined;
    return this.tutorService.streamChat(req.user.id, dto, res, image);
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
