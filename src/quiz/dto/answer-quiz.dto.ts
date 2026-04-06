import { IsInt, Min, Max } from 'class-validator';

export class AnswerQuizDto {
  @IsInt()
  @Min(1)
  @Max(5)
  userAnswer: number;
}
