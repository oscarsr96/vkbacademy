import { IsString, IsInt, MinLength, Min } from 'class-validator';

export class RedeemItemDto {
  @IsString()
  @MinLength(2)
  itemName: string;

  @IsInt()
  @Min(1)
  cost: number;
}
