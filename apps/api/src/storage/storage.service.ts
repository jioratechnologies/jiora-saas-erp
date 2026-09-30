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
    const rawEndpoint = process.env.OBJECT_STORAGE_ENDPOINT || "localhost";
    const endpointPort = process.env.OBJECT_STORAGE_PORT;
    const useSsl = process.env.OBJECT_STORAGE_USE_SSL === "true" || rawEndpoint.startsWith("https://");
    const protocol = useSsl ? "https" : "http";
    const endpointHost = rawEndpoint.replace(/^https?:\/\//, "");

    const endpoint =
      endpointPort && endpointPort !== "443" && endpointPort !== "80"
        ? `${protocol}://${endpointHost}:${endpointPort}`
        : `${protocol}://${endpointHost}`;

    this.bucket = process.env.OBJECT_STORAGE_BUCKET || "saas-erp-documents";

    this.client = new S3Client({
      endpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY || "saaserp",
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY || "saaserp_dev_password",
      },
      forcePathStyle: true, // Needed for path-style S3-compatible endpoints (MinIO, Garage, etc.)
    });

    this.ensureBucket().catch((err) => {
      this.logger.warn(`Object storage bucket init check failed: ${err.message}`);
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Object storage bucket "${this.bucket}" ready`);
    } catch (headErr) {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created object storage bucket "${this.bucket}"`);
      } catch (createErr: any) {
        if (createErr.name === "AccessDenied" || createErr.message?.includes("Access Denied")) {
          this.logger.warn(
            `Object storage bucket "${this.bucket}" does not exist and app user lacks CreateBucket permission. ` +
            `Ensure the bucket exists and is accessible before file operations. ` +
            `(Run the MinIO "setup" service first — see infra/docker-compose.minio.yaml — to create the bucket with proper permissions.)`,
          );
        } else {
          this.logger.warn(`Failed to create object storage bucket "${this.bucket}": ${createErr.message}`);
        }
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

  async getPresignedUrl(key: string, expiresIn = 900, downloadFilename?: string): Promise<string> {
    const cleanFilename = downloadFilename ? downloadFilename.replace(/[^a-zA-Z0-9._-]/g, "_") : undefined;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: cleanFilename ? `attachment; filename="${cleanFilename}"` : undefined,
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
      this.logger.warn(`Failed to delete object storage object "${key}": ${err.message}`);
    }
  }
}
