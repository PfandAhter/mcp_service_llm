// src/main.ts
// Application entry point

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { Configuration } from './config/configuration';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    const app = await NestFactory.create(AppModule);

    // Get typed config
    const configService = app.get(ConfigService<Configuration, true>);
    const port = configService.get('app.port', { infer: true });
    const environment = configService.get('app.environment', { infer: true });

    // Enable CORS
    app.enableCors({
        origin: '*',
        credentials: true,
    });

    await app.listen(port);

    logger.log(`🚀 LLM API Boilerplate running on http://localhost:${port}`);
    logger.log(`📡 WebSocket available at ws://localhost:${port}/chat`);
    logger.log(`🔧 HTTP endpoint: POST http://localhost:${port}/chat/message`);
    logger.log(`🌍 Environment: ${environment}`);
}

bootstrap();
