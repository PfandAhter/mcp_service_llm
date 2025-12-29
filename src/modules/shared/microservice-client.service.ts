import { Injectable, HttpException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { Configuration } from '../../config/configuration';

export interface UserContext {
    id: string;
    email: string;
}

@Injectable()
export class MicroserviceClientService {
    private readonly logger = new Logger(MicroserviceClientService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService<Configuration>,
    ) { }

    /**
     * Sends a POST request to a microservice with required user context headers.
     * @param serviceKey The key of the service as defined in configuration
     * @param endpoint The specific endpoint path (e.g., '/orders')
     * @param body The request body
     * @param userContext The user context (id and email)
     * @returns The response data from the microservice
     */
    async sendPostRequest<T>(
        serviceKey: string,
        endpoint: string,
        body: any,
        userContext: UserContext,
    ): Promise<T> {
        const services = this.configService.get('services', { infer: true });
        const baseUrl = services[serviceKey];

        if (!baseUrl) {
            this.logger.error(`Service URL not found for key: ${serviceKey}`);
            throw new Error(`Configuration for service '${serviceKey}' not found`);
        }

        const url = `${baseUrl}${endpoint}`;

        try {
            this.logger.log(`Sending POST request to ${serviceKey} at ${url}`);

            const response = await lastValueFrom(
                this.httpService.post(url, body, {
                    headers: {
                        'X-User-Id': userContext.id,
                        'X-User-Email': userContext.email,
                        'Content-Type': 'application/json',
                    },
                }),
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Error communicating with ${serviceKey}: ${error.message}`, error.stack);

            // Re-throw or wrap the error appropriate for your application
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                throw new HttpException(
                    error.response.data || 'Microservice Error',
                    error.response.status,
                );
            }
            throw error;
        }
    }

    /**
     * Sends a GET request to a microservice with required user context headers.
     * @param serviceKey The key of the service as defined in configuration
     * @param endpoint The specific endpoint path (e.g., '/transactions')
     * @param params The query parameters
     * @param userContext The user context (id and email)
     * @returns The response data from the microservice
     */
    async sendGetRequest<T>(
        serviceKey: string,
        endpoint: string,
        params: Record<string, any>,
        userContext: UserContext,
    ): Promise<T> {
        const services = this.configService.get('services', { infer: true });
        const baseUrl = services[serviceKey];

        if (!baseUrl) {
            this.logger.error(`Service URL not found for key: ${serviceKey}`);
            throw new Error(`Configuration for service '${serviceKey}' not found`);
        }

        const url = `${baseUrl}${endpoint}`;

        try {
            this.logger.log(`Sending GET request to ${serviceKey} at ${url}`);

            const response = await lastValueFrom(
                this.httpService.get(url, {
                    params,
                    headers: {
                        'X-User-Id': userContext.id,
                        'X-User-Email': userContext.email,
                    },
                }),
            );

            return response.data;
        } catch (error) {
            this.logger.error(`Error communicating with ${serviceKey}: ${error.message}`, error.stack);

            if (error.response) {
                throw new HttpException(
                    error.response.data || 'Microservice Error',
                    error.response.status,
                );
            }
            throw error;
        }
    }
}
