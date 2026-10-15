import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateOrderDto {
  /** Required for guests; logged-in users default to their account email. */
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  customerEmail?: string;

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
  @IsString()
  @Matches(/^(PENDING_PAYMENT|CONFIRMED|PROCESSING|SHIPPED|DELIVERED|CANCELLED|REFUNDED)$/)
  status!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string;
}
