// src/modules/metrics/metrics.service.ts
// Metrics service for recording application metrics

import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
    constructor(
        @InjectMetric('http_requests_total')
        private readonly httpRequestsTotal: Counter<string>,

        @InjectMetric('http_request_duration_seconds')
        private readonly httpRequestDuration: Histogram<string>,

        @InjectMetric('active_connections')
        private readonly activeConnections: Gauge<string>,

        @InjectMetric('llm_api_calls_total')
        private readonly llmApiCallsTotal: Counter<string>,

        @InjectMetric('llm_api_response_time_seconds')
        private readonly llmApiResponseTime: Histogram<string>,

        @InjectMetric('tool_calls_total')
        private readonly toolCallsTotal: Counter<string>,
    ) { }

    // HTTP Metrics
    recordHttpRequest(method: string, path: string, status: number): void {
        this.httpRequestsTotal.inc({ method, path, status: status.toString() });
    }

    recordHttpRequestDuration(method: string, path: string, status: number, durationSeconds: number): void {
        this.httpRequestDuration.observe(
            { method, path, status: status.toString() },
            durationSeconds,
        );
    }

    // Connection Metrics
    incrementActiveConnections(type: 'http' | 'websocket'): void {
        this.activeConnections.inc({ type });
    }

    decrementActiveConnections(type: 'http' | 'websocket'): void {
        this.activeConnections.dec({ type });
    }

    // LLM API Metrics
    recordLlmApiCall(provider: string, model: string, status: 'success' | 'error'): void {
        this.llmApiCallsTotal.inc({ provider, model, status });
    }

    recordLlmApiResponseTime(provider: string, model: string, durationSeconds: number): void {
        this.llmApiResponseTime.observe({ provider, model }, durationSeconds);
    }

    // Tool Call Metrics
    recordToolCall(toolName: string, status: 'success' | 'error'): void {
        this.toolCallsTotal.inc({ tool_name: toolName, status });
    }
}
