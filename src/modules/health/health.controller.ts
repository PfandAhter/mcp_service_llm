// src/modules/health/health.controller.ts
// Actuator-style health and info endpoints for Kubernetes probes and monitoring

import { Controller, Get } from '@nestjs/common';

interface HealthComponent {
    status: 'UP' | 'DOWN' | 'UNKNOWN';
    details?: Record<string, any>;
}

interface HealthResponse {
    status: 'UP' | 'DOWN';
    components: Record<string, HealthComponent>;
    timestamp: string;
}

@Controller('actuator')
export class HealthController {
    private readonly startTime = Date.now();

    @Get('health')
    health(): HealthResponse {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        return {
            status: 'UP',
            components: {
                diskSpace: {
                    status: 'UP',
                    details: {
                        free: 'N/A', // Would require additional package for disk info
                    },
                },
                ping: {
                    status: 'UP',
                },
                memory: {
                    status: memoryUsage.heapUsed < memoryUsage.heapTotal * 0.9 ? 'UP' : 'DOWN',
                    details: {
                        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
                        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
                        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB',
                    },
                },
                uptime: {
                    status: 'UP',
                    details: {
                        seconds: Math.floor(uptime),
                        formatted: this.formatUptime(uptime),
                    },
                },
            },
            timestamp: new Date().toISOString(),
        };
    }

    @Get('health/liveness')
    liveness() {
        return {
            status: 'UP',
            timestamp: new Date().toISOString(),
        };
    }

    @Get('health/readiness')
    readiness() {
        return {
            status: 'UP',
            timestamp: new Date().toISOString(),
        };
    }

    @Get('info')
    info() {
        return {
            app: {
                name: 'llm-api-boilerplate',
                description: 'NestJS boilerplate for LLM API integrations with tool calling support',
                version: process.env.npm_package_version || '1.0.0',
            },
            build: {
                timestamp: new Date().toISOString(),
            },
            runtime: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
            },
        };
    }

    @Get('metrics')
    metrics() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            mem: {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                rss: memoryUsage.rss,
                external: memoryUsage.external,
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system,
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        };
    }

    @Get('env')
    env() {
        // Return safe environment info (not exposing secrets)
        return {
            activeProfiles: process.env.NODE_ENV || 'development',
            applicationName: 'llm-api-boilerplate',
            port: process.env.PORT || 3000,
        };
    }

    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${secs}s`);

        return parts.join(' ');
    }
}
