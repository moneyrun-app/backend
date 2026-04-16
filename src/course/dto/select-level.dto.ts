import { IsString, IsIn } from 'class-validator';

export class SelectLevelDto {
  @IsString()
  @IsIn(['beginner', 'find-level'])
  choice: string;
}
