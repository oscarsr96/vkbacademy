import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DailyService } from './daily.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construye un Response mock mínimo compatible con el contrato que usa DailyService. */
function makeFetchResponse(options: {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}): Response {
  return {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    json: options.json ?? (() => Promise.resolve({})),
    text: options.text ?? (() => Promise.resolve('')),
  } as unknown as Response;
}

/** Crea un TestingModule con DailyService y ConfigService mockeado. */
async function buildModule(apiKeyValue: string): Promise<DailyService> {
  const mockConfig = {
    get: jest.fn((key: string, defaultVal?: unknown) =>
      key === 'DAILY_API_KEY' ? apiKeyValue : defaultVal,
    ),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DailyService,
      { provide: ConfigService, useValue: mockConfig },
    ],
  }).compile();

  return module.get<DailyService>(DailyService);
}

// ---------------------------------------------------------------------------
// Suite principal
// ---------------------------------------------------------------------------

describe('DailyService', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Sin API key
  // -------------------------------------------------------------------------

  describe('sin API key configurada', () => {
    let service: DailyService;

    beforeEach(async () => {
      service = await buildModule('');
    });

    it('createRoom devuelve null sin llamar a fetch', async () => {
      const result = await service.createRoom(
        'booking-123',
        new Date('2026-04-01T10:00:00Z'),
        new Date('2026-04-01T11:00:00Z'),
      );

      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('deleteRoom retorna sin llamar a fetch', async () => {
      await service.deleteRoom('booking-123');

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Con API key
  // -------------------------------------------------------------------------

  describe('con API key configurada', () => {
    let service: DailyService;
    const BOOKING_ID = 'abc-456';
    const START = new Date('2026-04-01T10:00:00Z');
    const END = new Date('2026-04-01T11:00:00Z');

    beforeEach(async () => {
      service = await buildModule('test-daily-key');
    });

    it('createRoom construye el roomName como vkb-{bookingId}', async () => {
      fetchSpy.mockResolvedValue(
        makeFetchResponse({
          ok: true,
          json: () => Promise.resolve({ url: 'https://vkb.daily.co/vkb-abc-456', name: `vkb-${BOOKING_ID}` }),
        }),
      );

      await service.createRoom(BOOKING_ID, START, END);

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { name: string };
      expect(body.name).toBe(`vkb-${BOOKING_ID}`);
    });

    it('createRoom devuelve la URL de la sala cuando la respuesta es exitosa', async () => {
      const expectedUrl = 'https://vkb.daily.co/vkb-abc-456';
      fetchSpy.mockResolvedValue(
        makeFetchResponse({
          ok: true,
          json: () => Promise.resolve({ url: expectedUrl, name: `vkb-${BOOKING_ID}` }),
        }),
      );

      const result = await service.createRoom(BOOKING_ID, START, END);

      expect(result).toBe(expectedUrl);
    });

    it('createRoom devuelve null cuando la respuesta HTTP no es exitosa', async () => {
      fetchSpy.mockResolvedValue(
        makeFetchResponse({
          ok: false,
          status: 422,
          text: () => Promise.resolve('Unprocessable Entity'),
        }),
      );

      const result = await service.createRoom(BOOKING_ID, START, END);

      expect(result).toBeNull();
    });

    it('deleteRoom llama a DELETE con la URL correcta', async () => {
      fetchSpy.mockResolvedValue(makeFetchResponse({ ok: true, status: 200 }));

      await service.deleteRoom(BOOKING_ID);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`https://api.daily.co/v1/rooms/vkb-${BOOKING_ID}`);
      expect(init.method).toBe('DELETE');
    });

    it('deleteRoom no lanza excepción cuando la sala ya no existe (404)', async () => {
      fetchSpy.mockResolvedValue(
        makeFetchResponse({ ok: false, status: 404, text: () => Promise.resolve('Not Found') }),
      );

      await expect(service.deleteRoom(BOOKING_ID)).resolves.toBeUndefined();
    });
  });
});
