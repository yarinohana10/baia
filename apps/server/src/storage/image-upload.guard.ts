import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ascii = (buf: Buffer, start: number, end: number) => buf.toString('latin1', start, end);

/**
 * The real image type, read from the file's magic bytes (never from the
 * client-supplied filename or Content-Type). Null when it is not one of the
 * allowed formats.
 */
export function detectImageMime(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(buf, 0, 6))) return 'image/gif';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 12 && ascii(buf, 4, 8) === 'ftyp') {
    // ISO-BMFF: major brand at 8..12, then compatible brands up to the end of the ftyp box.
    const boxSize = Math.min(buf.readUInt32BE(0) || 32, 64, buf.length);
    const brands = [ascii(buf, 8, 12)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(ascii(buf, i, i + 4));
    if (brands.some((b) => b === 'avif' || b === 'avis')) return 'image/avif';
  }
  return null;
}

/**
 * In-memory multer storage (same as the default) that additionally verifies the
 * file's magic bytes. The declared Content-Type is only a hint: a file whose
 * content is not a jpeg/png/webp/avif/gif is rejected, and `mimetype` is set
 * to the detected type before it reaches the storage layer.
 */
export class SniffingMemoryStorage implements StorageEngine {
  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    cb: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const chunks: Buffer[] = [];
    file.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    file.stream.on('error', (err) => cb(err));
    file.stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const detected = detectImageMime(buffer);
      if (!detected) {
        cb(new BadRequestException('The file content is not a valid image (jpeg, png, webp, avif or gif).'));
        return;
      }
      cb(null, { buffer, size: buffer.length, mimetype: detected });
    });
  }

  _removeFile(_req: Request, _file: Express.Multer.File, cb: (error: Error | null) => void): void {
    cb(null);
  }
}

export const imageUploadOptions: MulterOptions = {
  storage: new SniffingMemoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new BadRequestException(
          `Invalid file type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
