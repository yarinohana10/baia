import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Optional fields: blank strings become undefined so they are simply not stored. */
const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};
const lowerTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export const CONTACT_LOCALES = ['he', 'en'] as const;
export const CONTACT_STATUSES = ['NEW', 'HANDLED'] as const;

/** Public contact-form submission. `website` is a honeypot: real users never fill it. */
export class CreateContactMessageDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{7,18}$/, { message: 'phone must be a valid phone number' })
  phone?: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderNumber?: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsIn(CONTACT_LOCALES)
  locale?: (typeof CONTACT_LOCALES)[number];

  /** Honeypot (visually hidden in the form). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}

export class UpdateContactMessageDto {
  @IsIn(CONTACT_STATUSES)
  status!: (typeof CONTACT_STATUSES)[number];
}
