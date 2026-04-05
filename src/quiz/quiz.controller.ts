import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnswerQuizDto } from './dto/answer-quiz.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('pacemaker/quiz/:id/answer')
  async answerQuiz(
    @CurrentUser('id') userId: string,
    @Param('id') quizId: string,
    @Body() dto: AnswerQuizDto,
  ) {
    return this.quizService.submitAnswer(userId, quizId, dto.userAnswer);
  }

  @Get('book/wrong-notes')
  async getWrongNotes(@CurrentUser('id') userId: string) {
    return this.quizService.getWrongNotes(userId);
  }
}
