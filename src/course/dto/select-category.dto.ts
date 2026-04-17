import { IsIn, IsString } from 'class-validator';

export class SelectCategoryDto {
  @IsString()
  @IsIn(['예적금', '연금', '주식', '부동산', '세금', '소비'])
  category: string;
}
