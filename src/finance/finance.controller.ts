import { Controller, Get, Patch, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    try {
      return await this.financeService.getFullProfile(userId);
    } catch (e) {
      if (e instanceof NotFoundException) {
        return { needsOnboarding: true };
      }
      throw e;
    }
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.financeService.updateProfile(userId, dto);
  }
}
