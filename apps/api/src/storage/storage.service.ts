import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client!: S3Client;
  private bucket!: string;

  onModuleInit() {
    const endpointHost = process.env.MINIO_ENDPOINT || "localhost";
    const endpointPort = process.env.MINIO_PORT || "9010";
    const useSsl = process.env.MINIO_USE_SSL === "true";
    const protocol = useSsl ? "https" : "http";

    this.bucket = process.env.MINIO_BUCKET || "saas-erp-documents";

    this.client = new S3Client({
      endpoint: `${protocol}://${endpointHost}:${endpointPort}`,
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "saaserp",
        secretAccessKey: process.env.MINIO_SECRET_KEY || "saaserp_dev_password",
      },
      forcePathStyle: true, // Needed for MinIO local buckets
    });

    this.ensureBucket().catch((err) => {
      this.logger.warn(`MinIO bucket init check failed: ${err.message}`);
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`MinIO bucket "${this.bucket}" ready`);
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created MinIO bucket "${this.bucket}"`);
      } catch (err: any) {
        this.logger.warn(`Failed to create MinIO bucket "${this.bucket}": ${err.message}`);
      }
    }
  }

  async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getPresignedUrl(key: string, expiresIn = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (err: any) {
      this.logger.warn(`Failed to delete MinIO object "${key}": ${err.message}`);
    }
  }
}
