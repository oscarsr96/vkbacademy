import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const VALID_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function buildService(keyValue: string | undefined): Promise<CryptoService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CryptoService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(keyValue) },
      },
    ],
  }).compile();
  return moduleRef.get(CryptoService);
}

describe('CryptoService', () => {
  it('encrypt + decrypt preserva el plaintext', async () => {
    const service = await buildService(VALID_KEY);
    const plain = 'aB3xY7Q9';
    const encrypted = service.encrypt(plain);
    expect(service.decrypt(encrypted)).toBe(plain);
  });

  it('produce ciphertext distinto en cada llamada con el mismo input (IV aleatorio)', async () => {
    const service = await buildService(VALID_KEY);
    const a = service.encrypt('same');
    const b = service.encrypt('same');
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same');
    expect(service.decrypt(b)).toBe('same');
  });

  it('detecta manipulación del ciphertext mediante el auth tag', async () => {
    const service = await buildService(VALID_KEY);
    const encrypted = service.encrypt('secret');
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith('0') ? '1' : '0');
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('falla al construirse si la clave tiene longitud incorrecta', async () => {
    await expect(buildService('tooshort')).rejects.toThrow('STUDENT_PASSWORD_ENC_KEY');
  });

  it('falla al construirse si la clave no está definida', async () => {
    await expect(buildService(undefined)).rejects.toThrow('STUDENT_PASSWORD_ENC_KEY');
  });

  it('rechaza payload con formato inválido al descifrar', async () => {
    const service = await buildService(VALID_KEY);
    expect(() => service.decrypt('no-colons')).toThrow();
    expect(() => service.decrypt('only:two')).toThrow();
  });
});
