import { Module } from '@nestjs/common';
import { PacemakerController } from './pacemaker.controller.js';
import { PacemakerService } from './pacemaker.service.js';
import { SimulatorModule } from '../simulator/simulator.module.js';

@Module({
  imports: [SimulatorModule],
  controllers: [PacemakerController],
  providers: [PacemakerService],
  exports: [PacemakerService],
})
export class PacemakerModule {}
