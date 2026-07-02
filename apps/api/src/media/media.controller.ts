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

  /**
   * Genera una URL firmada temporal para ver un vídeo.
   *
   * Autorización: solo roles de gestión de contenido pueden firmar una key
   * arbitraria. Tras la migración `remove_videokey_add_youtubeid` las lecciones
   * ya no guardan la key S3 (los vídeos son de YouTube vía `youtubeId`), por lo
   * que no existe mapeo key→recurso en BD para validar el acceso de un alumno a
   * una key concreta; el control más estricto disponible es limitar la firma a
   * quienes suben contenido (TEACHER/ADMIN; SUPER_ADMIN pasa por el chequeo ADMIN).
   */
  @Get('view-url/:key(*)')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  getViewUrl(@Param('key') key: string) {
    return this.mediaService.getViewUrl(key);
  }
}
