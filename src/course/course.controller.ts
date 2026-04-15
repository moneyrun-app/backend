import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CourseService } from './course.service';
import { MissionService } from './mission.service';
import { CompleteMissionDto } from './dto/complete-mission.dto';

@Controller('course')
@UseGuards(JwtAuthGuard)
export class CourseController {
  constructor(
    private readonly courseService: CourseService,
    private readonly missionService: MissionService,
  ) {}

  /** 활성 코스 조회 */
  @Get('active')
  getActive(@Request() req: any) {
    return this.courseService.getActiveCourse(req.user.id);
  }

  /** 수강 가능한 코스 목록 */
  @Get('available')
  getAvailable(@Request() req: any) {
    return this.courseService.getAvailableCourses(req.user.id);
  }

  /** 마이북 생성 진행률 폴링 */
  @Get('generate/status/:purchaseId')
  getGenerateStatus(@Param('purchaseId') purchaseId: string) {
    return this.courseService.getGenerationStatus(purchaseId);
  }

  /** 코스 상세 */
  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.courseService.getCourseDetail(id);
  }

  /** 새 코스 시작 */
  @Post(':id/start')
  start(@Request() req: any, @Param('id') id: string) {
    return this.courseService.startCourse(req.user.id, id);
  }

  /** 활성 코스 완료 */
  @Post('active/complete')
  complete(@Request() req: any) {
    return this.courseService.completeCourse(req.user.id);
  }

  /** 활성 코스 전체 미션 조회 */
  @Get('active/missions')
  async getMissions(@Request() req: any) {
    const active = await this.courseService.getActiveCourse(req.user.id);
    if (!active) return { courseTitle: null, missions: [], summary: { total: 0, completed: 0 } };

    const result = await this.missionService.getMissions(
      req.user.id,
      active.userCourseId,
      active.courseId,
    );
    return { courseTitle: active.title, ...result };
  }

  /** 특정 챕터 미션 조회 */
  @Get('active/missions/chapter/:num')
  async getMissionsByChapter(
    @Request() req: any,
    @Param('num', ParseIntPipe) num: number,
  ) {
    const active = await this.courseService.getActiveCourse(req.user.id);
    if (!active) return { missions: [], summary: { total: 0, completed: 0 } };

    return this.missionService.getMissionsByChapter(
      req.user.id,
      active.userCourseId,
      active.courseId,
      num,
    );
  }

  /** 미션 완료 */
  @Post('missions/:id/complete')
  async completeMission(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CompleteMissionDto,
  ) {
    const active = await this.courseService.getActiveCourse(req.user.id);
    if (!active) {
      return { error: '활성 코스가 없습니다.' };
    }

    const result = await this.missionService.completeMission(
      req.user.id,
      active.userCourseId,
      id,
      dto.note,
    );
    return { ...result, totalMissions: active.missionSummary.total };
  }
}
