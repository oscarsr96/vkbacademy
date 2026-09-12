import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_SIDE, downscaleImage, fitWithin } from './downscaleImage';

describe('fitWithin', () => {
  it('reduce el lado mayor a 1568 manteniendo la proporción', () => {
    expect(fitWithin(3000, 2000)).toEqual({ width: 1568, height: 1045 });
  });

  it('no agranda una imagen pequeña', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('funciona en vertical', () => {
    expect(fitWithin(2000, 4000)).toEqual({ width: 784, height: 1568 });
  });

  it('MAX_IMAGE_SIDE es el máximo útil de Claude', () => {
    expect(MAX_IMAGE_SIDE).toBe(1568);
  });
});

describe('downscaleImage', () => {
  // jsdom no pinta: se sustituyen createImageBitmap y el canvas por dobles
  // que recuerdan a qué tamaño se les pidió dibujar.
  const drawImage = vi.fn();
  let canvasSize: { width: number; height: number } | undefined;

  function stubBrowser(width: number, height: number) {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width, height, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb: BlobCallback,
      type?: string,
    ) {
      canvasSize = { width: this.width, height: this.height };
      cb(new Blob(['x'], { type }));
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    canvasSize = undefined;
  });

  it('dibuja al tamaño reducido y devuelve JPEG', async () => {
    stubBrowser(3000, 2000);

    const out = await downscaleImage(new Blob(['orig'], { type: 'image/png' }));

    expect(canvasSize).toEqual({ width: 1568, height: 1045 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1568, 1045);
    expect(out.type).toBe('image/jpeg');
  });

  it('pide JPEG con calidad 0.85', async () => {
    stubBrowser(800, 600);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');

    await downscaleImage(new Blob(['orig'], { type: 'image/jpeg' }));

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });
});
