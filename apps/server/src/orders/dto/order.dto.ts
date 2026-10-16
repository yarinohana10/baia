import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { OrderStatus } from '../../generated/prisma';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateOrderDto {
  /** Required for guests; logged-in users default to their account email. */
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  customerEmail?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  recipientName!: string;

  /** Israeli or international number: digits, spaces, dashes, optional leading +. */
  @Transform(trim)
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{7,18}$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  @IsOptional()
  @IsIn(['he', 'en'])
  locale?: 'he' | 'en';

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  couponCode?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shippingCity!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  shippingStreet!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  shippingNumber!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  shippingApartment?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  shippingZip?: string;

  // NOTE: no cartId — the cart is always resolved from the caller's own
  // identity (session user or httpOnly guest-cart cookie). Unknown fields
  // are stripped by the whitelisting ValidationPipe.
}

export class OrderAccessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token!: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
}

/** Query string for the admin orders list. Unknown statuses are rejected (400). */
export class AdminOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  /** Matches order number, customer email or recipient name (case-insensitive). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
