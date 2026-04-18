import * as request from 'supertest';
import {
  createApp,
  closeApp,
  login,
  authGet,
  authDelete,
  publicGet,
} from './setup';
import { INestApplication } from '@nestjs/common';

describe('Tutor Chat — /tutor', () => {
  let app: INestApplication;
  let studentToken: string;

  beforeAll(async () => {
    app = await createApp();
    const s = await login('student@vkbacademy.com');
    studentToken = s.accessToken;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── POST /tutor/chat ──────────────────────────────────────────────────────

  describe('POST /tutor/chat', () => {
    it('devuelve 401 sin token de autenticación', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tutor/chat')
        .send({ message: '¿Qué es la fotosíntesis?' });

      expect(res.status).toBe(401);
    });

    it('devuelve 400 cuando falta el campo message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tutor/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('devuelve 400 cuando message es una cadena vacía', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tutor/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ message: '' });

      expect(res.status).toBe(400);
    });

    it('acepta la petición de un STUDENT y no devuelve 401 ni 403', async () => {
      // El endpoint usa SSE: los headers (200) se envían antes de que arranque
      // el streaming. Si no hay clave de Anthropic, el error se escribe en el
      // stream y el servidor cierra la conexión de todas formas con status 200.
      // Lo que verificamos es que auth y validación del DTO pasan sin error.
      const res = await request(app.getHttpServer())
        .post('/api/tutor/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ message: '¿Qué es la fotosíntesis?' })
        .buffer(true)
        .timeout(5000);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('acepta campos opcionales de contexto sin error de validación', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tutor/chat')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          message: '¿Cómo se calcula el área de un triángulo?',
          courseName: 'Matemáticas 3º ESO',
          lessonName: 'Geometría plana',
          schoolYear: '3º ESO',
        })
        .buffer(true)
        .timeout(5000);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(400);
    });
  });

  // ─── GET /tutor/history ────────────────────────────────────────────────────

  describe('GET /tutor/history', () => {
    it('devuelve 401 sin token de autenticación', async () => {
      const res = await publicGet('/tutor/history');
      expect(res.status).toBe(401);
    });

    it('devuelve 200 y un array para un STUDENT autenticado', async () => {
      const res = await authGet('/tutor/history', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('cada mensaje del historial tiene los campos esperados', async () => {
      const res = await authGet('/tutor/history', studentToken);

      expect(res.status).toBe(200);

      // Si hay mensajes en el historial, verificar la forma de cada uno
      for (const msg of res.body) {
        expect(msg).toHaveProperty('id');
        expect(msg).toHaveProperty('role');
        expect(msg).toHaveProperty('content');
        expect(msg).toHaveProperty('createdAt');
        expect(['user', 'assistant']).toContain(msg.role);
      }
    });
  });

  // ─── DELETE /tutor/history ─────────────────────────────────────────────────

  describe('DELETE /tutor/history', () => {
    it('devuelve 401 sin token de autenticación', async () => {
      const res = await request(app.getHttpServer()).delete(
        '/api/tutor/history',
      );

      expect(res.status).toBe(401);
    });

    it('devuelve 200 con { cleared: true } para un STUDENT autenticado', async () => {
      const res = await authDelete('/tutor/history', studentToken);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ cleared: true });
    });

    it('tras el DELETE, GET /tutor/history devuelve un array vacío', async () => {
      // Asegurarse de que el historial está limpio
      await authDelete('/tutor/history', studentToken);

      const res = await authGet('/tutor/history', studentToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });
  });
});
