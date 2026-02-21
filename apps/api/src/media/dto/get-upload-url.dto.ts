import { IsString, Matches } from 'class-validator';

export class GetUploadUrlDto {
  @IsString()
  @Matches(/\.(mp4|mov|avi|webm)$/i, { message: 'Solo se permiten archivos de vídeo' })
  fileName: string;

  @IsString()
  @Matches(/^video\//, { message: 'El contentType debe ser de tipo video' })
  contentType: string;
}
