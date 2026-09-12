/**
 * Reduce una foto antes de subirla al tutor.
 *
 * 1568 px es el lado mayor que Claude usa de verdad: por encima solo se pagan
 * tokens y tiempo de subida. Una foto de móvil de 4 MB se queda en ~300 KB.
 */
export const MAX_IMAGE_SIDE = 1568;
const JPEG_QUALITY = 0.85;

/** Tamaño destino sin deformar. Nunca agranda. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function downscaleImage(file: Blob, maxSide: number = MAX_IMAGE_SIDE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('No se pudo procesar la foto');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la foto'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
