import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class MediaService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly signedUrlExpires: number;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: config.get('AWS_REGION', 'eu-west-1'),
      credentials: {
        accessKeyId: config.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: config.get('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
    this.bucket = config.get('AWS_S3_BUCKET', '');
    this.signedUrlExpires = config.get<number>('AWS_SIGNED_URL_EXPIRES', 3600);
  }

  /** Genera presigned URL de PUT para subir al S3 */
  async getUploadUrl(fileName: string, contentType: string) {
    const extension = fileName.split('.').pop();
    const key = `videos/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300, // 5 minutos para subir
    });

    return { uploadUrl, key };
  }

  /** Genera presigned URL de GET para ver el vídeo */
  async getViewUrl(key: string) {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.s3, command, { expiresIn: this.signedUrlExpires });
    return { url, expiresIn: this.signedUrlExpires };
  }
}
