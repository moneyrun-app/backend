import { IsArray, ValidateNested, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

class DiagnosticAnswer {
  @IsString()
  questionId: string;

  @IsInt()
  @Min(0)
  answer: number;
}

export class SubmitDiagnosticDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosticAnswer)
  answers: DiagnosticAnswer[];
}
