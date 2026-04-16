import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { SelectLevelDto } from './dto/select-level.dto';
import { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto';

@Controller('course/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /** 온보딩 진행 상태 조회 (이어하기용) */
  @Get('status')
  getStatus(@Request() req: any) {
    return this.onboardingService.getStatus(req.user.id);
  }

  /** 코스 레벨 선택: 기초부터 시작 or 내 레벨 찾기 */
  @Post('select-level')
  selectLevel(@Request() req: any, @Body() dto: SelectLevelDto) {
    return this.onboardingService.selectLevel(req.user.id, dto.choice);
  }

  /** 진단퀴즈 문제 조회 (힌트 포함) */
  @Get('quiz/questions')
  quizQuestions(@Request() req: any) {
    return this.onboardingService.getQuizQuestions(req.user.id);
  }

  /** 진단퀴즈 답변 제출 → 레벨 배정 + AI 마이북 생성 자동 시작 */
  @Post('quiz/submit')
  quizSubmit(@Request() req: any, @Body() dto: SubmitDiagnosticDto) {
    return this.onboardingService.submitQuizAndGenerate(req.user.id, dto.answers);
  }

  /** AI 마이북 생성 상태 폴링 */
  @Get('generation-status')
  generationStatus(@Request() req: any) {
    return this.onboardingService.getGenerationStatus(req.user.id);
  }

  /** 온보딩 완료 */
  @Post('complete')
  complete(@Request() req: any) {
    return this.onboardingService.completeOnboarding(req.user.id);
  }
}
