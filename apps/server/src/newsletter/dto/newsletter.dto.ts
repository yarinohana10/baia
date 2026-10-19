import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';

const lowerTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export const NEWSLETTER_LOCALES = ['he', 'en'] as const;
/** Where the opt-in happened (kept as proof of consent). */
export const NEWSLETTER_SOURCES = ['footer', 'checkout', 'register', 'account'] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

export class SubscribeDto {
  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsIn(NEWSLETTER_LOCALES)
  locale?: (typeof NEWSLETTER_LOCALES)[number];

  /** Explicit, active opt-in is required by law (חוק התקשורת 30א) - never assumed. */
  @Equals(true, { message: 'consent must be true' })
  consent!: boolean;

  @IsOptional()
  @IsIn(['footer', 'checkout', 'register'])
  source?: NewsletterSource;
}

export class UnsubscribeDto {
  @Transform(lowerTrim)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

/** The signed-in user's marketing-email preference. */
export class UpdateMyConsentDto {
  @IsBoolean()
  consent!: boolean;

  @IsOptional()
  @IsIn(NEWSLETTER_LOCALES)
  locale?: (typeof NEWSLETTER_LOCALES)[number];

  @IsOptional()
  @IsIn(['register', 'account', 'checkout'])
  source?: NewsletterSource;
}
