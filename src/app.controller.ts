import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AppService } from './app.service';

@ApiTags('health')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness check' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  getHealth(): { status: 'ok' } {
    return this.appService.getHealth();
  }
}
