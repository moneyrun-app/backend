import { Module } from '@nestjs/common';
import { SimulationController } from './simulation.controller';
import { SimulationService } from './simulation.service';
import { ConstantsModule } from '../constants/constants.module';

@Module({
  imports: [ConstantsModule],
  controllers: [SimulationController],
  providers: [SimulationService],
})
export class SimulationModule {}
