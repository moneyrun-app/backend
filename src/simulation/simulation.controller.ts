import { Controller, Post, Body } from '@nestjs/common';
import { SimulationService } from './simulation.service';
import { SimulationDto } from './dto/simulation.dto';

@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('calculate')
  async calculate(@Body() dto: SimulationDto) {
    return this.simulationService.calculate(dto);
  }
}
