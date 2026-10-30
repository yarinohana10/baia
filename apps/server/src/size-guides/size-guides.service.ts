import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { FieldError, fieldValidationException } from '../common/validation';
import type { CreateSizeGuideDto, SizeGuideTableDto, UpdateSizeGuideDto } from './dto/size-guide.dto';

const ORDER: Prisma.SizeGuideOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { nameEn: 'asc' }];

const INCLUDE = {
  imageUpload: { select: { s3Key: true } },
  categories: { select: { id: true, slug: true, nameHe: true, nameEn: true, parentId: true }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.SizeGuideInclude;

type GuideRow = Prisma.SizeGuideGetPayload<{ include: typeof INCLUDE }>;

/**
 * Every row must have exactly one cell per column, so the storefront can
 * render the table as stored. Returns the offending paths (empty when valid).
 */
export function tableShapeErrors(tables: SizeGuideTableDto[]): FieldError[] {
  const errors: FieldError[] = [];
  tables.forEach((table, t) => {
    table.rows.forEach((row, r) => {
      if (row.values.length !== table.columns.length) {
        errors.push({
          field: `tables.${t}.rows.${r}.values`,
          code: 'columnMismatch',
          message: `Row "${row.labelEn}" has ${row.values.length} values for ${table.columns.length} columns`,
        });
      }
    });
  });
  return errors;
}

/**
 * Size guides (Women / Men / Kids ...): one storefront page each plus the
 * product-page dialog of the categories linked to them. All content is
 * bilingual and edited in the admin; the illustration lives in the assets bucket.
 */
@Injectable()
export class SizeGuidesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private present(guide: GuideRow) {
    const { imageUpload, ...rest } = guide;
    return { ...rest, imageUrl: imageUpload ? this.storage.getUrl(imageUpload.s3Key) : null };
  }

  /** Active guides for the storefront, in display order. */
  async listActive() {
    const guides = await this.prisma.sizeGuide.findMany({ where: { isActive: true }, include: INCLUDE, orderBy: ORDER });
    return guides.map((g) => this.present(g));
  }

  async listAll() {
    const guides = await this.prisma.sizeGuide.findMany({ include: INCLUDE, orderBy: ORDER });
    return guides.map((g) => this.present(g));
  }

  async findById(id: string) {
    const guide = await this.prisma.sizeGuide.findUnique({ where: { id }, include: INCLUDE });
    if (!guide) throw new NotFoundException('Size guide not found');
    return this.present(guide);
  }

  async create(data: CreateSizeGuideDto) {
    this.assertTables(data.tables);
    const guide = await this.prisma.sizeGuide.create({ data: this.toData(data) as Prisma.SizeGuideCreateInput, include: INCLUDE });
    return this.present(guide);
  }

  async update(id: string, data: UpdateSizeGuideDto) {
    await this.assertExists(id);
    this.assertTables(data.tables);
    const guide = await this.prisma.sizeGuide.update({ where: { id }, data: this.toData(data), include: INCLUDE });
    return this.present(guide);
  }

  /** Deletes the guide; linked categories fall back to no guide (FK is SET NULL). */
  async remove(id: string) {
    const guide = await this.prisma.sizeGuide.findUnique({ where: { id }, include: { imageUpload: true } });
    if (!guide) throw new NotFoundException('Size guide not found');
    await this.prisma.sizeGuide.delete({ where: { id } });
    if (guide.imageUpload) await this.removeUpload(guide.imageUpload.id, guide.imageUpload.s3Key);
    return { deleted: true };
  }

  async uploadImage(id: string, file: Buffer, originalName: string, mimeType: string, uploadedBy?: string) {
    const guide = await this.prisma.sizeGuide.findUnique({ where: { id }, include: { imageUpload: true } });
    if (!guide) throw new NotFoundException('Size guide not found');

    const ext = (originalName.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const s3Key = `size-guides/${id}/${randomUUID()}.${ext}`;

    // New image first: if anything fails the guide keeps its current image.
    await this.storage.upload(file, s3Key, mimeType);
    let uploadId: string | null = null;
    let updated: GuideRow;
    try {
      const upload = await this.prisma.upload.create({
        data: {
          s3Key,
          s3Bucket: process.env.S3_BUCKET || 'baia-assets',
          mimeType,
          sizeBytes: file.length,
          fileName: originalName,
          uploadedBy,
        },
      });
      uploadId = upload.id;
      updated = await this.prisma.sizeGuide.update({ where: { id }, data: { imageUploadId: upload.id }, include: INCLUDE });
    } catch (err) {
      if (uploadId) await this.prisma.upload.delete({ where: { id: uploadId } }).catch(() => {});
      await this.storage.delete(s3Key).catch(() => {});
      throw err;
    }

    if (guide.imageUpload) await this.removeUpload(guide.imageUpload.id, guide.imageUpload.s3Key);
    return this.present(updated);
  }

  async removeImage(id: string) {
    const guide = await this.prisma.sizeGuide.findUnique({ where: { id }, include: { imageUpload: true } });
    if (!guide) throw new NotFoundException('Size guide not found');
    if (!guide.imageUpload) throw new NotFoundException('Size guide has no image');
    const updated = await this.prisma.sizeGuide.update({ where: { id }, data: { imageUploadId: null }, include: INCLUDE });
    await this.removeUpload(guide.imageUpload.id, guide.imageUpload.s3Key);
    return this.present(updated);
  }

  private toData(data: UpdateSizeGuideDto): Prisma.SizeGuideUpdateInput {
    const { tables, steps, tips, ...scalars } = data;
    return {
      ...scalars,
      ...(tables !== undefined ? { tables: tables as unknown as Prisma.InputJsonValue } : {}),
      ...(steps !== undefined ? { steps: steps as unknown as Prisma.InputJsonValue } : {}),
      ...(tips !== undefined ? { tips: tips as unknown as Prisma.InputJsonValue } : {}),
    };
  }

  private assertTables(tables: SizeGuideTableDto[] | undefined) {
    if (!tables) return;
    const errors = tableShapeErrors(tables);
    if (errors.length) throw fieldValidationException(errors);
  }

  private async assertExists(id: string) {
    const found = await this.prisma.sizeGuide.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Size guide not found');
  }

  private async removeUpload(uploadId: string, s3Key: string) {
    await this.prisma.upload.delete({ where: { id: uploadId } }).catch(() => {});
    await this.storage.delete(s3Key).catch(() => {});
  }
}
