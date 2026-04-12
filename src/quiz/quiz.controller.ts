import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnswerQuizDto } from './dto/answer-quiz.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  // ========== 오늘의 퀴즈 (독립 API) ==========

  @Get('quiz/today')
  async getTodayQuiz(@CurrentUser('id') userId: string) {
    const quiz = await this.quizService.getTodayQuiz(userId);
    const { data: user } = await this.quizService.getUserLevel(userId);
    return {
      quiz,               // null이면 이미 풀었음
      currentLevel: user?.quiz_level || 1,
      solvedToday: quiz === null,
    };
  }

  // ========== 퀴즈 답변 (출석 자동 체크) ==========

  @Post('quiz/:id/answer')
  async answerQuiz(
    @CurrentUser('id') userId: string,
    @Param('id') quizId: string,
    @Body() dto: AnswerQuizDto,
  ) {
    return this.quizService.submitAnswerV2(userId, quizId, dto.answer);
  }

  // ========== 난이도 변경 ==========

  @Patch('quiz/level')
  async changeLevel(
    @CurrentUser('id') userId: string,
    @Body('level') level: number,
  ) {
    return this.quizService.changeQuizLevel(userId, level);
  }

  // ========== 출석 ==========

  @Get('attendance/streak')
  async getStreak(@CurrentUser('id') userId: string) {
    return this.quizService.getAttendanceStreak(userId);
  }

  @Get('attendance/history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('month') month: string,
  ) {
    return this.quizService.getAttendanceHistory(userId, month);
  }

  // ========== 퀴즈 스크랩 ==========

  @Post('quiz/:id/scrap')
  async toggleScrap(
    @CurrentUser('id') userId: string,
    @Param('id') quizId: string,
    @Body('note') note?: string,
  ) {
    return this.quizService.toggleQuizScrap(userId, quizId, note);
  }

  // ========== 오답 노트 ==========

  @Get('my-book/wrong-notes')
  async getWrongNotes(@CurrentUser('id') userId: string) {
    return this.quizService.getWrongNotes(userId);
  }
}
