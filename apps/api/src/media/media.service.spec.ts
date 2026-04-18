import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Mocks de módulos AWS — deben declararse antes del import del servicio
// ---------------------------------------------------------------------------

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.signed-url.example.com'),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports que dependen de los mocks anteriores
// ---------------------------------------------------------------------------

import { MediaService } from './media.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENV: Record<string, unknown> = {
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'AKID',
  AWS_SECRET_ACCESS_KEY: 'SECRET',
  AWS_S3_BUCKET: 'test-bucket',
  AWS_SIGNED_URL_EXPIRES: 3600,
};

function buildMockConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const merged = { ...ENV, ...overrides };
  return {
    get: jest.fn((key: string, defaultVal?: unknown) => merged[key] ?? defaultVal),
  } as unknown as ConfigService;
}

async function buildModule(configService: ConfigService): Promise<MediaService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MediaService,
      { provide: ConfigService, useValue: configService },
    ],
  }).compile();

  return module.get<MediaService>(MediaService);
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('MediaService', () => {
  let service: MediaService;
  const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;
  const MockedPutObjectCommand = PutObjectCommand as jest.MockedClass<typeof PutObjectCommand>;
  const MockedGetObjectCommand = GetObjectCommand as jest.MockedClass<typeof GetObjectCommand>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedGetSignedUrl.mockResolvedValue('https://s3.signed-url.example.com');
    service = await buildModule(buildMockConfig());
  });

  // -------------------------------------------------------------------------
  // getUploadUrl
  // -------------------------------------------------------------------------

  describe('getUploadUrl', () => {
    it('genera una key con prefijo videos/ y la extensión del fichero original', async () => {
      const { key } = await service.getUploadUrl('lesson-intro.mp4', 'video/mp4');

      expect(key).toMatch(/^videos\/.+\.mp4$/);
    });

    it('genera keys únicas en llamadas distintas', async () => {
      const [{ key: key1 }, { key: key2 }] = await Promise.all([
        service.getUploadUrl('video.mp4', 'video/mp4'),
        service.getUploadUrl('video.mp4', 'video/mp4'),
      ]);

      expect(key1).not.toBe(key2);
    });

    it('devuelve { uploadUrl, key } con la URL firmada de PUT', async () => {
      const expectedUrl = 'https://s3.signed-url.example.com';

      const result = await service.getUploadUrl('clase.webm', 'video/webm');

      expect(result).toEqual({
        uploadUrl: expectedUrl,
        key: expect.stringMatching(/^videos\/.+\.webm$/),
      });
    });

    it('construye PutObjectCommand con el bucket y contentType correctos', async () => {
      await service.getUploadUrl('demo.mp4', 'video/mp4');

      expect(MockedPutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          ContentType: 'video/mp4',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getViewUrl
  // -------------------------------------------------------------------------

  describe('getViewUrl', () => {
    it('construye GetObjectCommand con el bucket y la key recibida', async () => {
      const key = 'videos/some-uuid.mp4';

      await service.getViewUrl(key);

      expect(MockedGetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      });
    });

    it('devuelve { url, expiresIn } con la URL firmada', async () => {
      const result = await service.getViewUrl('videos/some-uuid.mp4');

      expect(result).toEqual({
        url: 'https://s3.signed-url.example.com',
        expiresIn: 3600,
      });
    });

    it('expiresIn refleja el valor de AWS_SIGNED_URL_EXPIRES en config', async () => {
      const customService = await buildModule(
        buildMockConfig({ AWS_SIGNED_URL_EXPIRES: 7200 }),
      );

      const { expiresIn } = await customService.getViewUrl('videos/any.mp4');

      expect(expiresIn).toBe(7200);
      expect(mockedGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 7200 }),
      );
    });
  });
});
