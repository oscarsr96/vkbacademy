import {
  createApp,
  closeApp,
  login,
  authGet,
  authPost,
  publicPost,
  publicGet,
} from './setup';

describe('Media — /media', () => {
  let studentToken: string;
  let teacherToken: string;

  beforeAll(async () => {
    await createApp();

    const [s, t] = await Promise.all([
      login('student@vkbacademy.com'),
      login('teacher@vkbacademy.com'),
    ]);

    studentToken = s.accessToken;
    teacherToken = t.accessToken;
  });

  afterAll(async () => {
    await closeApp();
  });

  // ─── POST /media/upload-url ────────────────────────────────────────────────

  describe('POST /media/upload-url', () => {
    it('devuelve 401 sin token de autenticación', async () => {
      const res = await publicPost('/media/upload-url', {
        fileName: 'video.mp4',
        contentType: 'video/mp4',
      });

      expect(res.status).toBe(401);
    });

    it('devuelve 403 cuando un STUDENT intenta obtener una URL de subida', async () => {
      const res = await authPost('/media/upload-url', studentToken, {
        fileName: 'video.mp4',
        contentType: 'video/mp4',
      });

      expect(res.status).toBe(403);
    });

    it('devuelve 400 si el body está vacío', async () => {
      const res = await authPost('/media/upload-url', teacherToken, {});

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si fileName no tiene extensión de vídeo válida', async () => {
      const res = await authPost('/media/upload-url', teacherToken, {
        fileName: 'documento.pdf',
        contentType: 'video/mp4',
      });

      expect(res.status).toBe(400);
    });

    it('devuelve 400 si contentType no es de tipo video', async () => {
      const res = await authPost('/media/upload-url', teacherToken, {
        fileName: 'video.mp4',
        contentType: 'image/jpeg',
      });

      expect(res.status).toBe(400);
    });

    it('un TEACHER con credenciales válidas no recibe 401 ni 403 (auth y roles pasan)', async () => {
      // En entorno de test sin credenciales AWS reales, el SDK puede lanzar un
      // error 500. Lo que verificamos es que la capa de autenticación y roles
      // funciona correctamente; un 500 de S3 es un resultado aceptable.
      const res = await authPost('/media/upload-url', teacherToken, {
        fileName: 'leccion.mp4',
        contentType: 'video/mp4',
      });

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // ─── GET /media/view-url/:key ──────────────────────────────────────────────

  describe('GET /media/view-url/:key', () => {
    it('devuelve 401 sin token de autenticación', async () => {
      const res = await publicGet('/media/view-url/cursos/leccion-01.mp4');

      expect(res.status).toBe(401);
    });

    it('un STUDENT autenticado no recibe 401 ni 403 (cualquier rol puede ver vídeos)', async () => {
      // Igual que upload-url: sin AWS real el SDK puede devolver 500, pero
      // lo que importa es que auth pasa y el rol STUDENT tiene acceso.
      const res = await authGet(
        '/media/view-url/cursos/leccion-01.mp4',
        studentToken,
      );

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
