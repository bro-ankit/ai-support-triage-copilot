import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KbModule } from './app/kb/kb.module';
import { TicketsModule } from './app/tickets/tickets.module';
import { CoreInfraModule } from './core-infra.module';
import { McpModule } from './mcp/mcp.module';

@Module({
  imports: [
    CoreInfraModule,
    KbModule,
    TicketsModule,
    McpModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env['NODE_ENV'] !== 'production' ? { target: 'pino-pretty' } : undefined,
        redact: {
          paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]'],
          censor: '[REDACTED]',
        },
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
