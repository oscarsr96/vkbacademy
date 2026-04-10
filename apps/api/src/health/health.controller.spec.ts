import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('devuelve status=ok con timestamp y uptime', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    // timestamp debe ser un ISO-8601 parseable
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('incluye la versión del nodo en el payload', () => {
    const result = controller.check();
    expect(result.node).toBe(process.version);
  });
});
