import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DeliveryMethod, OrderStatus, RefundStatus } from '../../generated/prisma';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Courier orders need a street address; pickup orders use the point's (any address sent is ignored). */
const needsAddress = (o: { deliveryMethod?: DeliveryMethod }) => o.deliveryMethod !== DeliveryMethod.PICKUP_POINT;

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

  /** COURIER (default) or PICKUP_POINT. */
  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  /** Required for PICKUP_POINT; the address is then taken from the point. */
  @ValidateIf((o: CreateOrderDto) => o.deliveryMethod === DeliveryMethod.PICKUP_POINT)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  pickupPointId?: string;

  /** The unticked-by-default "send me offers" checkbox. */
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  // Address: required for courier delivery only.
  @ValidateIf(needsAddress)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shippingCity?: string;

  @ValidateIf(needsAddress)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  shippingStreet?: string;

  @ValidateIf(needsAddress)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  shippingNumber?: string;

  /** Apartment, floor, entrance… (Israeli addresses often need all three). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
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

  /** First Israel calendar day (YYYY-MM-DD), inclusive. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** Last Israel calendar day (YYYY-MM-DD), inclusive. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

/** Public order lookup (order-status and cancel-order pages). */
export class OrderLookupDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  orderNumber!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

/** Admin CSV export: same filters as the list (Israel calendar days, inclusive). */
export class AdminOrdersExportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export const RESENDABLE_EMAILS = [
  'order-confirmation',
  'admin-new-order',
  'order-processing',
  'order-shipped',
  'order-delivered',
  'order-cancelled',
  'refund-completed',
] as const;
export type ResendableEmail = (typeof RESENDABLE_EMAILS)[number];

export class ResendOrderEmailDto {
  @IsIn(RESENDABLE_EMAILS)
  template!: ResendableEmail;
}

export class CompleteRefundDto {
  /** The provider's refund id / reference, for the books. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  providerRef?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class FailRefundDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AdminRefundsQueryDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
