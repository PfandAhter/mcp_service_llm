// src/modules/metrics/metrics.interceptor.ts
// HTTP request metrics interceptor

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
    constructor(private readonly metricsService: MetricsService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const startTime = Date.now();

        // Skip metrics endpoint to avoid recursion
        if (request.url?.includes('/actuator/prometheus')) {
            return next.handle();
        }

        return next.handle().pipe(
            tap({
                next: () => {
                    this.recordMetrics(request, response, startTime);
                },
                error: () => {
                    this.recordMetrics(request, response, startTime);
                },
            }),
        );
    }

    private recordMetrics(request: any, response: any, startTime: number): void {
        const method = request.method;
        const path = this.normalizePath(request.route?.path || request.url);
        const status = response.statusCode;
        const durationSeconds = (Date.now() - startTime) / 1000;

        this.metricsService.recordHttpRequest(method, path, status);
        this.metricsService.recordHttpRequestDuration(method, path, status, durationSeconds);
    }

    private normalizePath(path: string): string {
        // Remove query parameters and normalize path
        return path.split('?')[0].replace(/\/\d+/g, '/:id');
    }
}
