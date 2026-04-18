import { IsString, IsInt, MinLength, MaxLength, Min } from 'class-validator';

export class RedeemItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  itemName: string;

  @IsInt()
  @Min(1)
  cost: number;
}
