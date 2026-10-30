import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SLUG_PATTERN } from '../../products/dto/product.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimAll = ({ value }: { value: unknown }) =>
  Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value;
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
const present = (_: object, value: unknown) => value !== null && value !== undefined;

/** Limits that keep a guide readable (and the JSON columns small). */
export const SIZE_GUIDE_LIMITS = { tables: 10, columns: 15, rows: 20, steps: 12, tips: 10 } as const;

export class SizeGuideRowDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  labelHe!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  labelEn!: string;

  /** One cell per table column, in column order ("" = no value). */
  @Transform(trimAll)
  @IsArray()
  @ArrayMaxSize(SIZE_GUIDE_LIMITS.columns)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  values!: string[];
}

export class SizeGuideTableDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  titleHe!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  titleEn!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(200)
  noteHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(200)
  noteEn?: string | null;

  /** Size labels across the top, e.g. ["XS", "S", "M"]. */
  @Transform(trimAll)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SIZE_GUIDE_LIMITS.columns)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(20, { each: true })
  columns!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SIZE_GUIDE_LIMITS.rows)
  @ValidateNested({ each: true })
  @Type(() => SizeGuideRowDto)
  rows!: SizeGuideRowDto[];
}

export class SizeGuideStepDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  titleHe!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  titleEn!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  bodyHe!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  bodyEn!: string;
}

export class SizeGuideTipDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  he!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  en!: string;
}

export class CreateSizeGuideDto {
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase letters, digits and dashes' })
  slug!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nameHe!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nameEn!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(600)
  introHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(600)
  introEn?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(200)
  imageAltHe?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(200)
  imageAltEn?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SIZE_GUIDE_LIMITS.tables)
  @ValidateNested({ each: true })
  @Type(() => SizeGuideTableDto)
  tables?: SizeGuideTableDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SIZE_GUIDE_LIMITS.steps)
  @ValidateNested({ each: true })
  @Type(() => SizeGuideStepDto)
  steps?: SizeGuideStepDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SIZE_GUIDE_LIMITS.tips)
  @ValidateNested({ each: true })
  @Type(() => SizeGuideTipDto)
  tips?: SizeGuideTipDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class UpdateSizeGuideDto extends PartialType(CreateSizeGuideDto) {}
