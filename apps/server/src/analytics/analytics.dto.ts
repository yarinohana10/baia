import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { RANGE_PRESETS } from './date-range';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The date range every analytics endpoint takes: a `preset`, or `from`/`to`
 * (YYYY-MM-DD, inclusive, Israel days; `to` defaults to today). `from` wins over `preset`.
 */
export class AnalyticsRangeQueryDto {
  @IsOptional()
  @IsIn(RANGE_PRESETS)
  preset?: string;

  @IsOptional()
  @Matches(DAY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DAY, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}

export class TopProductsQueryDto extends AnalyticsRangeQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
