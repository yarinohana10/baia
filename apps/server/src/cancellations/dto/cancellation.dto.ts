import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CancellationStatus } from '../../generated/prisma';
import { CANCELLATION_REASONS, type CancellationReason } from '../../orders/cancellation-eligibility';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export { CANCELLATION_REASONS, type CancellationReason } from '../../orders/cancellation-eligibility';
const PHONE = /^\+?[0-9][0-9\s-]{7,18}$/;

export class SelfCancelDto {
  @IsIn(CANCELLATION_REASONS)
  reason!: CancellationReason;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class CancellationRequestDto extends SelfCancelDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(PHONE, { message: 'contactPhone must be a valid phone number' })
  contactPhone?: string;
}

/** Public /cancel-order form: proves the order with number + email. */
export class PublicCancellationDto extends CancellationRequestDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  orderNumber!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  /** Ignored: an order that has not shipped is always cancelled instantly. Kept so older clients still validate. */
  @IsOptional()
  @IsBoolean()
  instant?: boolean;
}

export class AdminCancellationsQueryDto {
  @IsOptional()
  @IsEnum(CancellationStatus)
  status?: CancellationStatus;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class ResolveCancellationDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  /** Kept by the store (approve only). 0 inside the free window. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  feeAmount?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

/** Admin "cancel order" from the orders screen. */
export class AdminCancelOrderDto {
  /** Refund total − fee through the payment provider (paid orders). */
  @IsBoolean()
  refund!: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  feeAmount?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
