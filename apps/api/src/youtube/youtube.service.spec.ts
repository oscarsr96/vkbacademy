import { ConfigService } from '@nestjs/config';
import { YoutubeService } from './youtube.service';

// Usamos require en lugar de `import ... from '.../x.json'` porque ts-jest
// en modo CommonJS sin esModuleInterop devuelve undefined al hacer default
// import de JSON. require() siempre devuelve el objeto JSON parseado.
const searchList = require('./__fixtures__/search-list-20-results.json');
const videosListMixed = require('./__fixtures__/videos-list-mixed.json');
const videosListAllLong = require('./__fixtures__/videos-list-all-long.json');
const videosListWithWhitelisted = require('./__fixtures__/videos-list-with-whitelisted.json');

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe('YoutubeService', () => {
  let service: YoutubeService;
  let config: { get: jest.Mock };

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => (key === 'YOUTUBE_API_KEY' ? 'fake-key' : undefined)),
    };
    service = new YoutubeService(config as unknown as ConfigService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findCandidates', () => {
    it('devuelve candidatos filtrados y ordenados con la query correctamente formada', async () => {
      mockFetchOnce(searchList);
      mockFetchOnce(videosListMixed);

      const result = await service.findCandidates('Propiedades de logaritmos', '1º Bachillerato');

      // Verifica el orden y el filtrado:
      // - vid003 excluido (>20min), vid004 excluido (stats vacías), vid005 excluido (ageRestricted)
      // - quedan vid001 (whitelisted, score 15000/500000 + 0.5 = 0.53) y vid002 (50000/1000000 = 0.05)
      expect(result).toHaveLength(2);
      expect(result[0].youtubeId).toBe('vid001');
      expect(result[0].isWhitelisted).toBe(true);
      expect(result[0].engagementRatio).toBeCloseTo(0.03, 3);
      expect(result[1].youtubeId).toBe('vid002');
      expect(result[1].isWhitelisted).toBe(false);

      // Verifica la query construida en el primer fetch (search.list)
      const firstCall = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(firstCall).toContain('/youtube/v3/search');
      expect(firstCall).toContain(encodeURIComponent('Propiedades de logaritmos 1º Bachillerato'));
      expect(firstCall).toContain('relevanceLanguage=es');
      expect(firstCall).toContain('regionCode=ES');
      expect(firstCall).toContain('safeSearch=strict');
      expect(firstCall).toContain('videoDuration=any');
      expect(firstCall).toContain('maxResults=20');
      expect(firstCall).toContain('key=fake-key');
    });

    it('devuelve [] cuando todos los candidatos superan 20 min', async () => {
      mockFetchOnce({ items: [{ id: { videoId: 'vid001' } }] });
      mockFetchOnce(videosListAllLong);

      const result = await service.findCandidates('q', 'y');
      expect(result).toEqual([]);
    });

    it('prefiere vídeo whitelisted aunque su ratio sea inferior', async () => {
      mockFetchOnce({
        items: [{ id: { videoId: 'vidWL' } }, { id: { videoId: 'vidNoWL' } }],
      });
      mockFetchOnce(videosListWithWhitelisted);

      const result = await service.findCandidates('q', 'y');
      expect(result[0].youtubeId).toBe('vidWL');
      expect(result[0].isWhitelisted).toBe(true);
      expect(result[1].youtubeId).toBe('vidNoWL');
    });

    it('respeta excludeIds antes de llamar a videos.list', async () => {
      mockFetchOnce({
        items: [{ id: { videoId: 'vid001' } }, { id: { videoId: 'vid002' } }],
      });
      // Solo vid002 debería llegar al segundo fetch
      mockFetchOnce({
        items: [
          {
            id: 'vid002',
            snippet: {
              title: 't',
              channelId: 'c',
              channelTitle: 'ct',
              publishedAt: '2020-01-01T00:00:00Z',
              thumbnails: { medium: { url: 'u' } },
            },
            contentDetails: { duration: 'PT5M0S' },
            statistics: { viewCount: '100', likeCount: '10' },
          },
        ],
      });

      await service.findCandidates('q', 'y', { excludeIds: ['vid001'] });

      const videosCall = (global.fetch as jest.Mock).mock.calls[1][0] as string;
      expect(videosCall).toContain('id=vid002');
      expect(videosCall).not.toContain('vid001');
    });

    it('respeta el parámetro limit', async () => {
      mockFetchOnce({
        items: [{ id: { videoId: 'vidWL' } }, { id: { videoId: 'vidNoWL' } }],
      });
      mockFetchOnce(videosListWithWhitelisted);

      const result = await service.findCandidates('q', 'y', { limit: 1 });
      expect(result).toHaveLength(1);
    });

    it('devuelve [] si YOUTUBE_API_KEY no está configurada (sin llamar a fetch)', async () => {
      config.get.mockReturnValue(undefined);
      const serviceNoKey = new YoutubeService(config as never);

      const result = await serviceNoKey.findCandidates('q', 'y');
      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('devuelve [] si search.list responde 403 (cuota agotada)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'quotaExceeded' } }),
      });

      const result = await service.findCandidates('q', 'y');
      expect(result).toEqual([]);
    });

    it('devuelve [] si fetch lanza error de red', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      const result = await service.findCandidates('q', 'y');
      expect(result).toEqual([]);
    });

    it('devuelve [] si search.list responde items vacío', async () => {
      mockFetchOnce({ items: [] });

      const result = await service.findCandidates('q', 'y');
      expect(result).toEqual([]);
    });
  });

  describe('findBestVideo', () => {
    it('devuelve el primer candidato o null', async () => {
      mockFetchOnce({
        items: [{ id: { videoId: 'vidWL' } }, { id: { videoId: 'vidNoWL' } }],
      });
      mockFetchOnce(videosListWithWhitelisted);

      const result = await service.findBestVideo('q', 'y');
      expect(result?.youtubeId).toBe('vidWL');
    });

    it('devuelve null si no hay candidatos', async () => {
      mockFetchOnce({ items: [] });
      const result = await service.findBestVideo('q', 'y');
      expect(result).toBeNull();
    });
  });
});
