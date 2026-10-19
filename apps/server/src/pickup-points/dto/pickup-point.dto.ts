import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class CreatePickupPointDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address!: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  hours?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdatePickupPointDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(200)
  hours?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class PickupPointsQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  city?: string;
}
