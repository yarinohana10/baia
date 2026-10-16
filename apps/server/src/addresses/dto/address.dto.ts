import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Optional fields: blank strings are stored as null so they can be cleared. */
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/** Same field rules as the shipping part of CreateOrderDto, so a saved address is always orderable. */
export class CreateAddressDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  recipientName!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{7,18}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  street!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  number!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(20)
  apartment?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(20)
  zip?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
