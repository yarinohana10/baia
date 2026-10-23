import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const trimString = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  pickupPointCost?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}(-\d{1,2})?$/, { message: 'ETA must look like "3-5" or "2"' })
  courierEtaDays?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}(-\d{1,2})?$/, { message: 'ETA must look like "3-5" or "2"' })
  pickupEtaDays?: string;

  @IsOptional() @Transform(trimString) @IsString() @IsNotEmpty() @MaxLength(120)
  businessName?: string;

  @IsOptional() @Transform(trimString) @IsString() @IsNotEmpty() @MaxLength(40)
  companyId?: string;

  @IsOptional() @Transform(trimString) @IsString() @IsNotEmpty() @MaxLength(200)
  businessAddress?: string;

  @IsOptional() @Transform(trimString) @IsString() @IsNotEmpty() @MaxLength(40)
  businessPhone?: string;

  @IsOptional() @Transform(trimString) @IsEmail() @MaxLength(254)
  contactEmail?: string;

  /** International format digits only (e.g. 972501234567); empty hides the WhatsApp button. */
  @Transform(emptyToNull)
  @ValidateIf(present)
  @Matches(/^[1-9]\d{7,14}$/, { message: 'whatsappNumber must be digits in international format, e.g. 972501234567' })
  whatsappNumber?: string | null;

  @IsOptional() @Transform(trimString) @IsString() @IsNotEmpty() @MaxLength(120)
  accessibilityCoordinatorName?: string;

  @IsOptional() @Transform(trimString) @IsString() @IsNotEmpty() @MaxLength(40)
  accessibilityCoordinatorPhone?: string;

  @IsOptional() @Transform(trimString) @IsEmail() @MaxLength(254)
  accessibilityCoordinatorEmail?: string;

  /** Stock at or under this count triggers the low-stock alert (0 = only when sold out). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  lowStockThreshold?: number;
}
