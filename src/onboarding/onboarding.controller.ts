import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OnboardingDto } from './dto/onboarding.dto';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  async onboard(
    @CurrentUser('id') userId: string,
    @Body() dto: OnboardingDto,
  ) {
    return this.onboardingService.completeOnboarding(userId, dto);
  }
}
