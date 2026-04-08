import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page || '1', 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    return this.adminService.getUsers(p, l);
  }

  @Get('quizzes')
  async getQuizzes() {
    return this.adminService.getQuizzes();
  }

  @Patch('constants/:key')
  async updateConstant(
    @Param('key') key: string,
    @Body('value') value: string,
  ) {
    return this.adminService.updateConstant(key, value);
  }
}
