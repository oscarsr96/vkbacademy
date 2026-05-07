import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENV_VAR = 'STUDENT_PASSWORD_ENC_KEY';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_HEX_LENGTH = 64; // 32 bytes

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>(ENV_VAR);
    if (!raw || raw.length !== KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(raw)) {
      throw new Error(
        `${ENV_VAR} debe ser una cadena hex de ${KEY_HEX_LENGTH} caracteres (32 bytes). Genérala con \`openssl rand -hex 32\`.`,
      );
    }
    this.key = Buffer.from(raw, 'hex');
  }

  /**
   * Cifra un texto plano con AES-256-GCM. Devuelve "iv:authTag:ciphertext" en hex.
   * Cada llamada produce un IV nuevo, por lo que la salida no es determinista.
   */
  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Descifra un payload "iv:authTag:ciphertext". Lanza si el auth tag no
   * cuadra (datos manipulados o clave incorrecta) o si el formato es inválido.
   */
  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de payload inválido');
    }
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
