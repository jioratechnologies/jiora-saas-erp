import { BadRequestException } from "@nestjs/common";
import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";

/**
 * Upload allowlists. Anything not listed is rejected at the door, so stored
 * content types are always one of these. Only INLINE_SAFE_MIME types are ever
 * served inline (rendered in the browser); everything else is download-only.
 * HTML / SVG / script content types are never accepted.
 */
export const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const DOCUMENT_MIME = [
  "application/pdf",
  ...IMAGE_MIME,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export const INLINE_SAFE_MIME: readonly string[] = ["application/pdf", ...IMAGE_MIME];

const MAX_BYTES = 10 * 1024 * 1024;

function rules(allowed: readonly string[], message: string, maxBytes = MAX_BYTES): MulterOptions {
  return {
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) =>
      allowed.includes(file.mimetype) ? cb(null, true) : cb(new BadRequestException(message), false),
  };
}

export const DOCUMENT_UPLOAD = rules(
  DOCUMENT_MIME,
  "This file type is not allowed. Upload a PDF, image, Word or Excel file (max 10 MB).",
);
export const IMAGE_UPLOAD = rules(
  IMAGE_MIME,
  "This file type is not allowed. Upload a PNG, JPEG or WebP image (max 10 MB).",
);
