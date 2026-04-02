import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.client = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      // 設定済みの場合のみ明示的に渡す（ローカル開発用）。未設定時はEC2 IAMロールを自動使用する
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
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

  async getPresignedUrl(s3Key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: s3Key });
    const url = await getSignedUrl(this.client, command, { expiresIn });

    // Docker環境ではPresigned URLが内部ホスト名になるため、ブラウザアクセス可能なURLに書き換える
    const internalEndpoint = this.configService.get<string>('S3_ENDPOINT');
    const publicEndpoint = this.configService.get<string>('S3_PUBLIC_ENDPOINT');
    if (internalEndpoint && publicEndpoint) {
      return url.replace(internalEndpoint, publicEndpoint);
    }
    return url;
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
