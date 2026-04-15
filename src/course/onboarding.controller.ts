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
import { SelectCategoryDto } from './dto/select-category.dto';
import { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto';
import { SubmitFinanceDataDto } from './dto/submit-finance-data.dto';

@Controller('course/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  /** 온보딩 진행 상태 조회 (이어하기용) */
  @Get('status')
  getStatus(@Request() req: any) {
    return this.onboardingService.getStatus(req.user.sub);
  }

  /** Step 1: 관심 분야 선택 */
  @Post('step1')
  step1(@Request() req: any, @Body() dto: SelectCategoryDto) {
    return this.onboardingService.step1SelectCategory(req.user.sub, dto.category);
  }

  /** Step 2: 진단퀴즈 문제 조회 */
  @Get('step2/questions')
  step2Questions(@Request() req: any) {
    return this.onboardingService.step2GetQuestions(req.user.sub);
  }

  /** Step 2: 진단퀴즈 답변 제출 */
  @Post('step2')
  step2Submit(@Request() req: any, @Body() dto: SubmitDiagnosticDto) {
    return this.onboardingService.step2Submit(req.user.sub, dto.answers);
  }

  /** Step 3: 재무 데이터 입력 */
  @Post('step3')
  step3(@Request() req: any, @Body() dto: SubmitFinanceDataDto) {
    return this.onboardingService.step3SubmitFinanceData(
      req.user.sub,
      dto.financeData,
      dto.courseExtraData,
    );
  }

  /** Step 4: AI 마이북 생성 시작 */
  @Post('step4/generate')
  step4Generate(@Request() req: any) {
    return this.onboardingService.step4Generate(req.user.sub);
  }

  /** Step 4: 생성 상태 폴링 */
  @Get('step4/status')
  step4Status(@Request() req: any) {
    return this.onboardingService.step4Status(req.user.sub);
  }

  /** Step 5: 온보딩 완료 */
  @Post('step5/complete')
  step5Complete(@Request() req: any) {
    return this.onboardingService.step5Complete(req.user.sub);
  }
}
