// src/app.module.ts
// Root application module

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMModule } from './modules/llm/llm.module';
import { ChatModule } from './modules/chat/chat.module';
import { MicroservicesModule } from './modules/shared/microservices.module';
import { HealthModule } from './modules/health/health.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsModule } from './modules/metrics/metrics.module';
import configuration from './config/configuration';
import { validate } from './config/validation';

/**
 * AppModule
 * 
 * Root module of the LLM API Boilerplate.
 * Uses typed configuration with environment validation.
 */
@Module({
    imports: [
        PrometheusModule.register(),
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            validate,
            // Cache config for performance
            cache: true,
            // Expand variables like ${VAR}
            expandVariables: true,
        }),
        LLMModule,
        ChatModule,
        MicroservicesModule,
        HealthModule,
        MetricsModule,
    ],
})
export class AppModule { }
