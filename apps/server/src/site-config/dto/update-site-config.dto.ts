import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const present = (_: object, value: unknown) => value !== null && value !== undefined;

/** A site-relative path (`/category/men`, not `//evil.com`) or an absolute http(s) URL. */
export const CTA_URL_PATTERN = /^(\/(?![/\\])\S*|https?:\/\/[^\s/?#]+\S*)$/i;

/**
 * Admin update of the singleton site config. Every field is optional; text
 * fields accept `null` (or an empty string) to clear them.
 */
export class UpdateSiteConfigDto {
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  shippingCost?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000)
  freeShippingThreshold?: number;

  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(120)
  heroTitleHe?: string | null;

  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(120)
  heroTitleEn?: string | null;

  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(300)
  heroSubtitleHe?: string | null;

  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(300)
  heroSubtitleEn?: string | null;

  @Transform(emptyToNull)
  @ValidateIf(present)
  @IsString()
  @MaxLength(500)
  @Matches(CTA_URL_PATTERN, {
    message: 'heroCtaUrl must be a relative path (e.g. /category/men) or an http(s) URL',
  })
  heroCtaUrl?: string | null;
}
