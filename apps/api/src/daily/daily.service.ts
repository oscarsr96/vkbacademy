import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface DailyRoomResponse {
  url: string;
  name: string;
}

@Injectable()
export class DailyService {
  private readonly logger = new Logger(DailyService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.daily.co/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('DAILY_API_KEY', '');
  }

  /**
   * Crea una sala de vídeo para la reserva indicada.
   * Devuelve la URL de la sala o null si no hay API key configurada.
   */
  async createRoom(bookingId: string, startAt: Date, endAt: Date): Promise<string | null> {
    if (!this.apiKey) {
      this.logger.warn('DAILY_API_KEY no configurada — la sala de vídeo no se creará');
      return null;
    }

    const roomName = `vkb-${bookingId}`;

    const res = await fetch(`${this.baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          // Accesible desde 15 min antes hasta 10 min después de la reserva
          nbf: Math.floor(startAt.getTime() / 1000) - 900,
          exp: Math.floor(endAt.getTime() / 1000) + 600,
          enable_prejoin_ui: false,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Error al crear sala Daily.co [${res.status}]: ${body}`);
      return null;
    }

    const room = (await res.json()) as DailyRoomResponse;
    return room.url;
  }

  /**
   * Elimina la sala asociada a una reserva al cancelarla.
   * Silencia el error 404 (sala ya inexistente).
   */
  async deleteRoom(bookingId: string): Promise<void> {
    if (!this.apiKey) return;

    const roomName = `vkb-${bookingId}`;
    const res = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      this.logger.error(`Error al eliminar sala Daily.co [${res.status}]: ${body}`);
    }
  }
}
