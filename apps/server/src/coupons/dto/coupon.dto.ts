import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;
/** `YYYY-MM-DD` (a calendar day, expires at the end of that day in Israel) or a full ISO timestamp. */
const EXPIRES_AT_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export type DiscountTypeValue = 'PERCENTAGE' | 'FIXED';
const DISCOUNT_TYPES: DiscountTypeValue[] = ['PERCENTAGE', 'FIXED'];

/** Value range depends on the type: PERCENTAGE 1–100, FIXED > 0. */
function IsCouponValue(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'couponValue',
      target: object.constructor,
      propertyName,
      options: { message: 'value must be 1–100 for PERCENTAGE coupons and greater than 0 for FIXED', ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'number' || !Number.isFinite(value)) return false;
          const type = (args.object as { discountType?: string }).discountType;
          if (type === 'PERCENTAGE') return value >= 1 && value <= 100;
          return value > 0;
        },
      },
    });
  };
}

function IsValidDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDate',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a date (YYYY-MM-DD) or ISO timestamp`, ...options },
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'string' &&
            EXPIRES_AT_PATTERN.test(value) &&
            !Number.isNaN(new Date(value).getTime())
          );
        },
      },
    });
  };
}

export class ValidateCouponDto {
  @Transform(upperTrim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  cartTotal!: number;
}

export class CreateCouponDto {
  @Transform(upperTrim)
  @IsString()
  @Matches(COUPON_CODE_PATTERN, {
    message: 'code must be 3–30 characters: letters, digits, "_" or "-"',
  })
  code!: string;

  @IsIn(DISCOUNT_TYPES)
  discountType!: DiscountTypeValue;

  @IsCouponValue()
  value!: number;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  minCartValue?: number | null;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUses?: number | null;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsValidDate()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * Partial update. `null` clears minCartValue / maxUses / expiresAt. When only
 * `value` (or only `discountType`) is sent, the service re-checks the value
 * against the stored type.
 */
export class UpdateCouponDto {
  @IsOptional()
  @Transform(upperTrim)
  @IsString()
  @Matches(COUPON_CODE_PATTERN, {
    message: 'code must be 3–30 characters: letters, digits, "_" or "-"',
  })
  code?: string;

  @IsOptional()
  @IsIn(DISCOUNT_TYPES)
  discountType?: DiscountTypeValue;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  value?: number;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  minCartValue?: number | null;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUses?: number | null;

  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsValidDate()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
