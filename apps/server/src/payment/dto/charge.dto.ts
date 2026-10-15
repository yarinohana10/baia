import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChargeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  orderId!: string;

  // Intentionally nothing else: amount, currency and email come from the
  // stored order. Extra fields (e.g. `amount`) are stripped by the pipe.
}
