import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AwsModule } from './aws/aws.module';
import { KafkaModule } from './kafka/kafka.module';


@Module({
  imports: [AdminModule, AwsModule, KafkaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
