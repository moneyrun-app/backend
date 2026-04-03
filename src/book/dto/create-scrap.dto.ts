import { IsUrl } from 'class-validator';

export class CreateScrapDto {
  @IsUrl()
  url: string;
}
