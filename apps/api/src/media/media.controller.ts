import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MediaService } from './media.service';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** Genera una presigned URL para subir un vídeo a S3 [TEACHER, ADMIN] */
  @Post('upload-url')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  getUploadUrl(@Body() dto: GetUploadUrlDto) {
    return this.mediaService.getUploadUrl(dto.fileName, dto.contentType);
  }

  /** Genera una URL firmada temporal para ver un vídeo */
  @Get('view-url/:key(*)')
  getViewUrl(@Param('key') key: string) {
    return this.mediaService.getViewUrl(key);
  }
}
