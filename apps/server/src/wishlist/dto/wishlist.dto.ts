import { ArrayMaxSize, IsArray, IsString, Matches, MaxLength } from 'class-validator';

export const MAX_WISHLIST_MERGE = 100;

export class MergeWishlistDto {
  @IsArray()
  @ArrayMaxSize(MAX_WISHLIST_MERGE)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @Matches(/^[A-Za-z0-9_-]+$/, { each: true })
  productIds!: string[];
}
