import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

interface S3UploadParams {
  buffer: Buffer;
  mimeType: string;
  s3Key: string;
}

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.client = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
      // ローカル開発時のみLocalStackへ向ける。本番では未設定にしてAWSデフォルトエンドポイントを使用する
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET_NAME');
  }

  async upload({ buffer, mimeType, s3Key }: S3UploadParams): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `S3へのアップロードに失敗しました: ${String(error)}`,
      );
    }
  }

  async getObject(s3Key: string): Promise<Buffer> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }),
      );
      const stream = response.Body;
      if (!stream) {
        throw new InternalServerErrorException('S3からの応答ボディが空です');
      }
      // ReadableStream → Buffer に変換
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      throw new InternalServerErrorException(
        `S3からの取得に失敗しました: ${String(error)}`,
      );
    }
  }
}
