import { IsBoolean } from 'class-validator';

export class AnswerQuizDto {
  @IsBoolean()
  userAnswer: boolean;
}
