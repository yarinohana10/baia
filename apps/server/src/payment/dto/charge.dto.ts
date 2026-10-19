import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  CARD_BRANDS,
  PAYMENT_METHODS,
  PAYMENT_SIMULATIONS,
  type CardBrand,
  type PaymentMethod,
  type PaymentSimulation,
} from '../payment.interface';

export const MAX_INSTALLMENTS = 12;

/**
 * What the hosted payment page tells us about a payment. PCI scope: the full
 * card number, CVV, expiry and the cardholder's ID number are NEVER sent here
 * (the strict validation pipe strips any field not declared below). Only the
 * brand and last four digits are kept, for display.
 */
export class PayDto {
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INSTALLMENTS)
  installments?: number;

  /** Test cards on the mock page; rejected unless a test-mode provider is bound outside production. */
  @IsOptional()
  @IsIn(PAYMENT_SIMULATIONS)
  simulation?: PaymentSimulation;

  @IsOptional()
  @IsIn(CARD_BRANDS)
  cardBrand?: CardBrand;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  cardLast4?: string;
}

export class ChargeDto extends PayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  orderId!: string;

  // Intentionally no amount/currency/email: they come from the stored order.
  // Extra fields (e.g. `amount`, `cardNumber`) are stripped by the pipe.
}
