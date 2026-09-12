import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { Response } from 'express';
import { TUTOR_IMAGE_MIME_TYPES } from './tutor.service';

/** Red de seguridad: el cliente ya reescala a ~300 KB antes de subir. */
export const TUTOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

/** Solo los formatos que entiende Claude. Lo demás, 400 con mensaje en español. */
export function tutorImageFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if ((TUTOR_IMAGE_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new HttpException('Solo se aceptan fotos JPG, PNG o WebP', HttpStatus.BAD_REQUEST), false);
}

/**
 * Sin `storage`: multer usa memoria, que es lo que queremos — la foto va al
 * modelo y muere con la request, nunca toca disco ni S3.
 */
export const tutorImageMulterOptions: MulterOptions = {
  limits: { fileSize: TUTOR_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: tutorImageFileFilter,
};

/**
 * multer corta con "File too large" antes de llegar al controlador y Nest lo
 * envuelve en PayloadTooLargeException. Este filtro solo cambia el mensaje
 * para que el alumno lea algo útil en su idioma.
 */
@Catch(PayloadTooLargeException)
export class TutorImageTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: 'La foto pesa demasiado (máximo 5 MB)',
    });
  }
}
