import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Kafka, KafkaConfig, Producer, ProducerRecord } from 'kafkajs';
import * as fs from 'fs';

@Injectable()
export class ProducerService implements OnModuleInit, OnApplicationShutdown {
  private readonly kafka = new Kafka({
    brokers: ['localhost:9092'],
    retry: {
        initialRetryTime: 30000, // initial delay in milliseconds
        retries: 1, // maximum number of retry attempts
      },
  });

  private readonly producer: Producer = this.kafka.producer();

  async onModuleInit() {
      await this.producer.connect();
  }

  async produce(record: ProducerRecord){
    console.log({record})
    await this.producer.send(record)
  }

  async produceLargeFile(record: ProducerRecord){
    console.log({record})
    await this.producer.send(record)
  }



  async onApplicationShutdown( ) {
      await this.producer.disconnect()
  }
}