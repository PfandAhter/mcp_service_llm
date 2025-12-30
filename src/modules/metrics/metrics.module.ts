// src/modules/metrics/metrics.module.ts
// Prometheus metrics module for application monitoring

import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
    imports: [
        PrometheusModule.register({
            path: '/actuator/prometheus',
            defaultMetrics: {
                enabled: true,
                config: {
                    prefix: 'llm_api_',
                },
            },
        }),
    ],
    providers: [
        MetricsService,
        // HTTP request counter
        makeCounterProvider({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'path', 'status'],
        }),
        // HTTP request duration histogram
        makeHistogramProvider({
            name: 'http_request_duration_seconds',
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'path', 'status'],
            buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        }),
        // Active connections gauge
        makeGaugeProvider({
            name: 'active_connections',
            help: 'Number of active connections',
            labelNames: ['type'],
        }),
        // LLM API calls counter
        makeCounterProvider({
            name: 'llm_api_calls_total',
            help: 'Total number of LLM API calls',
            labelNames: ['provider', 'model', 'status'],
        }),
        // LLM API response time histogram
        makeHistogramProvider({
            name: 'llm_api_response_time_seconds',
            help: 'LLM API response time in seconds',
            labelNames: ['provider', 'model'],
            buckets: [0.5, 1, 2, 5, 10, 30, 60],
        }),
        // Tool calls counter
        makeCounterProvider({
            name: 'tool_calls_total',
            help: 'Total number of tool function calls',
            labelNames: ['tool_name', 'status'],
        }),
        // Register interceptor globally
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
        },
    ],
    exports: [MetricsService],
})
export class MetricsModule { }
