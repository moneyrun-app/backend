import { IsInt, Min } from 'class-validator';

export class AnswerQuizDto {
  @IsInt()
  @Min(0)
  answer: number;
}
