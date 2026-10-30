import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SLUG_PATTERN } from '../../products/dto/product.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;
const present = (_: object, value: unknown) => value !== null && value !== undefined;

export class CreateCategoryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameHe!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nameEn!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  @Matches(SLUG_PATTERN, { message: 'slug must be lowercase letters, digits and dashes' })
  slug!: string;

  /** `null` (or empty) = top-level category. */
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  parentId?: string | null;

  /** `null` (or empty) = inherit the parent's size set. */
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  sizeSetId?: string | null;

  /** `null` (or empty) = inherit the parent's size guide. */
  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  sizeGuideId?: string | null;

  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(1000)
  image?: string | null;

  @IsOptional()
  @IsInt()
  @Min(-10000)
  @Max(10000)
  sortOrder?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
