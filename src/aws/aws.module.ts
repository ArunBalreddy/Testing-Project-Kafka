import { Module } from '@nestjs/common';
import { AwsController } from './aws.controller';
import { AwsService } from './aws.service';
import { ConfigService } from '@nestjs/config';
import { AwsConsumer } from './aws.consumer';
import { ProducerService } from 'src/kafka/producer/producer.service';
import { ConsumerService } from 'src/kafka/consumer/consumer.service';



@Module({
  controllers: [AwsController],
  providers: [AwsService, ConfigService, AwsConsumer, ProducerService, ConsumerService]
})
export class AwsModule {}
