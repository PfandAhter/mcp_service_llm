// src/modules/health/health.module.ts
// Health module for application health checks

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
    controllers: [HealthController],
})
export class HealthModule { }
