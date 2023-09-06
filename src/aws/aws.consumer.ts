import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConsumerService } from 'src/kafka/consumer/consumer.service';
import { AwsService } from './aws.service';
import * as fs from 'fs';

@Injectable()
export class AwsConsumer implements OnModuleInit {
  constructor(
    private readonly consumerService: ConsumerService,
    private readonly awsS3Service: AwsService,
  ) {} 

  async onModuleInit() {

    await this.consumerService.consume(
      { topic: 'upload-file-topic' },
      {
        eachMessage: async ({ topic, partition, message }) => {
          console.log('this is kafka consumer');
          const filePath = message.value.toString();
          const fileKey = message.key.toString();
          console.log({filePath, fileKey})
            const result = await this.awsS3Service.uploadFile(filePath, fileKey);
          console.log({ result });
          fs.unlinkSync(filePath);
          console.log({
            value: message.value.toString(),
            topic: topic.toString(),
            partition: partition.toString(),
          });
          return result as any;
        },
      },
    );

    await this.consumerService.consumeLargeFile(
      { topic: 'upload-large-file-topic' },
      {
        eachMessage: async ({ topic, partition, message }) => {
          console.log('this is kafka Large consumer');
          const filePath = message.value.toString();
          const fileKey = message.key.toString();
          console.log({filePath, fileKey})
          //   const result = await this.awsS3Service.uploadFile(file, fileKey);
          const result = await this.awsS3Service.uploadFileWithCLI(
            fileKey,
            filePath,
          );
          console.log({ result });
          fs.unlinkSync(filePath);
          console.log({
            value: message.value.toString(),
            topic: topic.toString(),
            partition: partition.toString(),
          });
          return result as any;
        },
      },
    );

    console.log('seconde oneeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
   
  }
}
