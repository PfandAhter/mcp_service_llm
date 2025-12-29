import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MicroserviceClientService } from './microservice-client.service';

@Global()
@Module({
    imports: [HttpModule],
    providers: [MicroserviceClientService],
    exports: [MicroserviceClientService],
})
export class MicroservicesModule { }
