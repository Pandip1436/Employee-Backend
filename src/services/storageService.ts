import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL } from "../config/r2";

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  folder: string;
}

export class StorageService {
  static buildKey(folder: string, originalName: string): string {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(originalName);
    const safeFolder = folder.replace(/^\/+|\/+$/g, "");
    return `${safeFolder}/${unique}${ext}`;
  }

  static async upload(input: UploadInput): Promise<string> {
    const key = this.buildKey(input.folder, input.originalName);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
      })
    );

    return key;
  }

  static async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 900
  ): Promise<string> {
    return getSignedUrl(
      r2Client,
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  }

  static getPublicUrl(key: string): string | null {
    if (!R2_PUBLIC_BASE_URL) return null;
    return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }

  static async delete(key: string): Promise<void> {
    await r2Client.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
    );
  }
}
