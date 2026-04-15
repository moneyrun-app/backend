import { IsIn, IsString } from 'class-validator';

export class SelectCategoryDto {
  @IsString()
  @IsIn(['연금', '주식', '부동산', '세금_연말정산', '소비_저축'])
  category: string;
}
