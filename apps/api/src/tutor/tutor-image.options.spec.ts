import { ArgumentsHost, HttpException, PayloadTooLargeException } from '@nestjs/common';
import {
  TUTOR_IMAGE_MAX_BYTES,
  TutorImageTooLargeFilter,
  tutorImageFileFilter,
  tutorImageMulterOptions,
} from './tutor-image.options';

describe('tutorImageFileFilter', () => {
  const asFile = (mimetype: string) => ({ mimetype }) as Express.Multer.File;

  it.each(['image/jpeg', 'image/png', 'image/webp'])('acepta %s', (mimetype) => {
    const cb = jest.fn();
    tutorImageFileFilter({} as never, asFile(mimetype), cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it.each(['application/pdf', 'image/gif', 'text/plain'])(
    'rechaza %s con 400 en español',
    (mimetype) => {
      const cb = jest.fn();
      tutorImageFileFilter({} as never, asFile(mimetype), cb);

      const [error, accept] = cb.mock.calls[0];
      expect(accept).toBe(false);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
      expect((error as HttpException).message).toBe('Solo se aceptan fotos JPG, PNG o WebP');
    },
  );
});

describe('tutorImageMulterOptions', () => {
  it('limita a un fichero de 5 MB', () => {
    expect(TUTOR_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(tutorImageMulterOptions.limits).toEqual({ fileSize: TUTOR_IMAGE_MAX_BYTES, files: 1 });
  });
});

describe('TutorImageTooLargeFilter', () => {
  it('traduce el 413 de multer a un mensaje en español con la forma { message, statusCode }', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new TutorImageTooLargeFilter().catch(new PayloadTooLargeException('File too large'), host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      message: 'La foto pesa demasiado (máximo 5 MB)',
    });
  });
});
