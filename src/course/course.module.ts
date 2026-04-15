import { Module } from '@nestjs/common';
import { CourseController } from './course.controller';
import { OnboardingController } from './onboarding.controller';
import { CourseService } from './course.service';
import { OnboardingService } from './onboarding.service';
import { CourseBookGenerator } from './course-book.generator';
import { MissionService } from './mission.service';
import { DiagnosticService } from './diagnostic.service';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [CourseController, OnboardingController],
  providers: [
    CourseService,
    OnboardingService,
    CourseBookGenerator,
    MissionService,
    DiagnosticService,
  ],
  exports: [CourseService, MissionService],
})
export class CourseModule {}
