import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  registerDecorator,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_IMAGES_PER_REQUEST = 20;
export const MAX_VARIANTS_PER_PRODUCT = 200;
/** Max lengths of the product-page content fields (per language). */
export const PRODUCT_CONTENT_MAX = { fabric: 1000, care: 2000, fit: 1000 } as const;

/** `saleEnd` must be strictly after `saleStart` when both are present. */
function IsAfterProperty(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'saleDateRange',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: { message: `${propertyName} must be after ${property}`, ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[args.constraints[0]];
          if (value == null || other == null) return true;
          const end = new Date(value as string).getTime();
          const start = new Date(other as string).getTime();
          if (Number.isNaN(end) || Number.isNaN(start)) return true; // IsDateString reports it
          return end > start;
        },
      },
    });
  };
}

// ─── Variants ────────────────────────────────────────────────

export class VariantDto {
  /** Present when updating an existing variant through the product endpoint. */
  @IsOptional()
  @IsString()
  id?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  color!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  size!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @IsInt()
  @Min(0)
  stockQuantity!: number;

  /** false = unlimited stock (never runs out; quantity is ignored). */
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  priceOverride?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  salePrice?: number | null;

  @IsOptional()
  @IsDateString()
  saleStart?: string | null;

  @IsOptional()
  @IsDateString()
  @IsAfterProperty('saleStart')
  saleEnd?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVariantDto extends PartialType(OmitType(VariantDto, ['id'] as const)) {}

// ─── Images ──────────────────────────────────────────────────

export class ImageMetaDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(50)
  color?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(300)
  altTextHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(300)
  altTextEn?: string | null;
}

export class ReorderImagesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  imageIds!: string[];
}

// ─── Products ────────────────────────────────────────────────

export class CreateProductDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameHe!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameEn!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  descriptionHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  descriptionEn?: string | null;

  /** Fabric & composition, e.g. "82% ניילון ממוחזר, 18% ליקרה". Empty strings are stored as null. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(PRODUCT_CONTENT_MAX.fabric)
  fabricHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(PRODUCT_CONTENT_MAX.fabric)
  fabricEn?: string | null;

  /** Care instructions (washing, drying). Empty strings are stored as null. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(PRODUCT_CONTENT_MAX.care)
  careHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(PRODUCT_CONTENT_MAX.care)
  careEn?: string | null;

  /** Fit notes, e.g. "הדוגמנית לובשת M, גובה 1.75". Empty strings are stored as null. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(PRODUCT_CONTENT_MAX.fit)
  fitHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(PRODUCT_CONTENT_MAX.fit)
  fitEn?: string | null;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(SLUG_PATTERN, { message: 'slug may only contain lowercase letters, digits and dashes' })
  slug!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  basePrice!: number;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Size set used for the variant size picker; null = custom sizes. */
  @IsOptional()
  @IsString()
  sizeSetId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VARIANTS_PER_PRODUCT)
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];

  /**
   * Metadata for the uploaded image files, aligned by index with the
   * multipart `images` files. The order is the gallery order (first = cover).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IMAGES_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => ImageMetaDto)
  images?: ImageMetaDto[];
}

/**
 * Partial update. When `variants` is present, entries with an `id` update that
 * variant and entries without one are created — all in one transaction.
 * Variants are removed through `DELETE admin/variants/:id`.
 */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['images'] as const)) {}
