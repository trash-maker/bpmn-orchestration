import { Consumer, Kafka, KafkaConfig, KafkaMessage, Producer } from 'kafkajs';
import { EventEmitter } from 'stream';

function toPromise(emitter: EventEmitter, event: string) {
  return new Promise((resolve, reject) => {
    emitter.once(event, resolve);
  });
}

function toMessage(raw: KafkaMessage): Message {
  let headers: Message['headers'] = undefined;
  try {
    headers = Object.fromEntries(
      Object.entries(raw.headers || {}).map(([key, value]) => [
        key,
        value?.toString(),
      ])
    );
  } catch (error) {
    console.warn(`error parsing headers!`);
  }

  let payload: Message['payload'];
  try {
    payload = JSON.parse(raw.value?.toString()!);
  } catch (error) {
    console.warn(`cannot parse message!`, {
      value: raw.value?.toString(),
    });
    payload = raw.value?.toString();
  }
  return { payload, headers };
}

export type Message = {
  headers?: { [key: string]: string | undefined };
  key?: string;
  payload?: { [key: string]: unknown } | string;
};

export class KafkaService {
  readonly message$ = new EventEmitter();
  private kafka: Kafka;
  private consumer: Consumer;
  private producer: Producer;

  constructor(private config: KafkaConfig) {
    this.kafka = new Kafka(config);
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({
      groupId: `${this.config.clientId}.group`,
    });
  }

  public async setup(subscribeTopics?: string) {
    await this.producer.connect();
    await this.consumer.connect();

    await this.consumer.subscribe({
      topic: new RegExp(`^${subscribeTopics || '(?!__).*'}$`),
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message: raw }) => {
        this.message$.emit(topic, toMessage(raw));
      },
    });
  }

  public async teardown() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  public async send(publishTopic: string, message: Message) {
    await this.producer.send({
      topic: publishTopic,
      messages: [
        {
          headers: message.headers,
          key: message.key,
          value: JSON.stringify(message.payload),
        },
      ],
    });
  }

  public async receive(
    receiveTopic: string,
    predicate?: (message: Message) => boolean
  ) {
    const result$ = new EventEmitter();
    const listener = (message: Message) => {
      if (predicate === undefined || predicate(message)) {
        this.message$.removeListener(receiveTopic, listener);
        result$.emit('result', message);
      }
    }
    this.message$.on(receiveTopic, listener);
    return await toPromise(result$, 'result');
  }
}
