import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

/**
 * 알림 글로벌 모듈.
 * 다른 모듈에서 NotificationsService를 주입받아 알림을 생성할 수 있도록 한다.
 */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
