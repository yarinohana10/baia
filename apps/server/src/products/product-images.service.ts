import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { Prisma } from '../generated/prisma';
import { fieldValidationException } from '../common/validation';
import type { ImageMetaDto } from './dto/product.dto';
import { IMAGE_INCLUDE } from './product-data';

/** Minimal file shape (subset of Express.Multer.File) the services need. */
export type IncomingFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size?: number;
};

/** A file already written to storage. */
export type StoredFile = { key: string; url: string };

type ImageWithUpload = {
  id: string;
  url: string;
  upload: { s3Key: string } | null;
  [key: string]: unknown;
};

/**
 * Product images: the files in storage (S3 / R2 / LocalStack) and their
 * ProductImage + Upload rows. Every image row owns exactly one storage object,
 * so removing an image (or a product) removes its file as well.
 */
@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  private get bucket() {
    return process.env.S3_BUCKET || 'baia-assets';
  }

  // ─── URLs ────────────────────────────────────────

  /** Builds the public URL from the storage key, so a CDN/bucket change needs no data migration. */
  resolve<T extends ImageWithUpload>(image: T): T {
    return image.upload ? { ...image, url: this.storage.getUrl(image.upload.s3Key) } : image;
  }

  resolveProduct<T extends { images?: ImageWithUpload[] }>(product: T): T {
    return product.images ? { ...product, images: product.images.map((img) => this.resolve(img)) } : product;
  }

  // ─── Storage ─────────────────────────────────────

  private key(productId: string, originalName: string) {
    const ext = (originalName.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    return `products/${productId}/${randomUUID()}.${ext}`;
  }

  /** Uploads files to storage; if any upload fails, the ones already uploaded are removed. */
  async putFiles(productId: string, files: IncomingFile[]): Promise<StoredFile[]> {
    const keys = files.map((f) => this.key(productId, f.originalname));
    const results = await Promise.allSettled(files.map((f, i) => this.storage.upload(f.buffer, keys[i], f.mimetype)));
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) {
      await this.removeKeys(keys.filter((_, i) => results[i].status === 'fulfilled'));
      throw (failed as PromiseRejectedResult).reason;
    }
    return keys.map((key, i) => ({ key, url: (results[i] as PromiseFulfilledResult<string>).value }));
  }

  /** Best effort: a leftover object is harmless (nothing links to it) and is logged. */
  async removeKeys(keys: string[]) {
    await Promise.all(
      keys.map((key) =>
        this.storage.delete(key).catch((err) => {
          this.logger.warn(`Failed to clean up storage object ${key}: ${err}`);
        }),
      ),
    );
  }

  /** ProductImage create data (with its Upload row) for a stored file. */
  imageData(stored: StoredFile, file: IncomingFile, meta: ImageMetaDto, sortOrder: number, uploadedBy?: string) {
    return {
      url: stored.url,
      sortOrder,
      color: meta.color ?? null,
      altTextHe: meta.altTextHe ?? null,
      altTextEn: meta.altTextEn ?? null,
      upload: {
        create: {
          s3Key: stored.key,
          s3Bucket: this.bucket,
          mimeType: file.mimetype,
          sizeBytes: file.size ?? file.buffer.length,
          fileName: file.originalname,
          uploadedBy,
        },
      },
    } satisfies Prisma.ProductImageCreateWithoutProductInput;
  }

  // ─── Image CRUD ──────────────────────────────────

  /** Adds an image after the product's current last one. */
  async upload(productId: string, file: IncomingFile | undefined, meta: ImageMetaDto = {}, uploadedBy?: string) {
    if (!file || !file.buffer) {
      throw fieldValidationException([{ field: 'file', code: 'required', message: 'An image file is required' }]);
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');

    const [stored] = await this.putFiles(productId, [file]);
    try {
      const image = await this.prisma.$transaction(async (tx) => {
        const { _max } = await tx.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
        const last = _max.sortOrder;
        return tx.productImage.create({
          data: {
            product: { connect: { id: productId } },
            ...this.imageData(stored, file, meta, last === null || last === undefined ? 0 : last + 1, uploadedBy),
          },
          include: { upload: true },
        });
      });
      return this.resolve(image);
    } catch (err) {
      // The row was not saved: remove the file so it doesn't linger in the bucket.
      await this.removeKeys([stored.key]);
      throw err;
    }
  }

  async update(imageId: string, meta: ImageMetaDto) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found');

    const data: Prisma.ProductImageUpdateInput = {};
    if (meta.color !== undefined) data.color = meta.color;
    if (meta.altTextHe !== undefined) data.altTextHe = meta.altTextHe;
    if (meta.altTextEn !== undefined) data.altTextEn = meta.altTextEn;

    const updated = await this.prisma.productImage.update({ where: { id: imageId }, data, include: { upload: true } });
    return this.resolve(updated);
  }

  /** Sets the gallery order; `imageIds` must list every image of the product exactly once. */
  async reorder(productId: string, imageIds: string[]) {
    const images = await this.prisma.productImage.findMany({ where: { productId }, select: { id: true } });
    if (images.length === 0) {
      const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new NotFoundException('Product not found');
    }

    const current = new Set(images.map((i) => i.id));
    const sameSet = imageIds.length === current.size && imageIds.every((id) => current.has(id));
    if (!sameSet) {
      throw fieldValidationException([
        { field: 'imageIds', code: 'mismatch', message: 'imageIds must contain every image of the product exactly once' },
      ]);
    }

    await this.prisma.$transaction(
      imageIds.map((id, index) => this.prisma.productImage.update({ where: { id }, data: { sortOrder: index } })),
    );
    const ordered = await this.prisma.productImage.findMany({ where: { productId }, ...IMAGE_INCLUDE });
    return ordered.map((img) => this.resolve(img));
  }

  /** Removes one image: its row, its Upload row, then its file in storage. */
  async delete(imageId: string) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId }, include: { upload: true } });
    if (!image) throw new NotFoundException('Image not found');

    // DB rows first so the product never points at a missing file.
    await this.prisma.productImage.delete({ where: { id: imageId } });
    if (image.upload) {
      await this.prisma.upload.delete({ where: { id: image.upload.id } });
      await this.removeKeys([image.upload.s3Key]);
    }
    return { deleted: true };
  }
}
