import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

/** Inicializa la app NestJS para tests E2E (una sola vez) */
export async function createApp(): Promise<INestApplication> {
  if (app) return app;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Desactivar rate limiting en tests E2E
    .overrideModule(ThrottlerModule)
    .useModule(ThrottlerModule.forRoot([{ ttl: 60000, limit: 100000 }]))
    .compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();
  prisma = app.get(PrismaService);
  return app;
}

export function getApp(): INestApplication {
  return app;
}

export function getPrisma(): PrismaService {
  return prisma;
}

/** Cierra la app al finalizar */
export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
  }
}

/** Helper: login y devuelve tokens + user */
export async function login(
  identifier: string,
  password = 'password123',
): Promise<{ accessToken: string; refreshToken: string; user: any }> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ identifier, password })
    .expect(200);
  return res.body;
}

/** Helper: request autenticado */
export function authGet(path: string, token: string) {
  return request(app.getHttpServer())
    .get(`/api${path}`)
    .set('Authorization', `Bearer ${token}`);
}

export function authPost(path: string, token: string, body?: any) {
  return request(app.getHttpServer())
    .post(`/api${path}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body ?? {});
}

export function authPatch(path: string, token: string, body?: any) {
  return request(app.getHttpServer())
    .patch(`/api${path}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body ?? {});
}

export function authDelete(path: string, token: string) {
  return request(app.getHttpServer())
    .delete(`/api${path}`)
    .set('Authorization', `Bearer ${token}`);
}

export function publicGet(path: string) {
  return request(app.getHttpServer()).get(`/api${path}`);
}

export function publicPost(path: string, body?: any) {
  return request(app.getHttpServer()).post(`/api${path}`).send(body ?? {});
}
