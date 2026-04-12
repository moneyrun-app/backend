import { IsObject, IsOptional } from 'class-validator';

export class PurchaseBookDto {
  @IsOptional()
  @IsObject()
  extraData: Record<string, any>;
}
