import { Controller, Get } from '@nestjs/common';
import { ConstantsService } from './constants.service';

@Controller('constants')
export class ConstantsController {
  constructor(private readonly constantsService: ConstantsService) {}

  @Get()
  async getConstants() {
    return this.constantsService.getAll();
  }
}
