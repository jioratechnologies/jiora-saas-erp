import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
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

  async ensureFileExists(key: string): Promise<void> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // Auto-create a valid minimal PDF file if key was missing (e.g. seeded data)
      const validPdf = Buffer.from(
        `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF`
      );
      try {
        await this.uploadFile(key, validPdf, "application/pdf");
        this.logger.log(`Created fallback file for key: ${key}`);
      } catch (uploadErr: any) {
        this.logger.warn(`Could not create fallback file for ${key}: ${uploadErr.message}`);
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
    await this.ensureFileExists(key);
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
      this.logger.warn(`Failed to delete MinIO object "${key}": ${err.message}`);
    }
  }
}
