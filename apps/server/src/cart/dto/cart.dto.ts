import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const MAX_LINE_QUANTITY = 99;

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  variantId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}

export class UpdateCartItemDto {
  /** 0 removes the line. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_LINE_QUANTITY)
  quantity!: number;
}
