import { Kafka } from 'kafkajs';

function uuid(length = 32): string {
  return Array(length)
    .fill('')
    .map((v) => Math.random().toString(16).charAt(2))
    .join('');
}

export async function registerToKafkaBroker() {
  const clientId = 'register-user';
  const kafka = new Kafka({
      clientId,
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  });
  const producer = kafka.producer();
  const consumer = kafka.consumer({
    groupId: `${clientId}.group`,
  });

  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({
    topic: process.env.RECEIVE_TOPIC!,
  });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message: raw }) => {
      // processing message
      const correlationID = raw.headers?.correlationID?.toString();
      let payload: any = undefined;
      try {
        payload = JSON.parse(raw.value?.toString()!);
      } catch (error) {
        console.log('❌ Cannot parse payload for message', { correlationID });
      }
  
      console.log('🕐 Processing message', { correlationID, payload });
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10000));
      
      console.log('✅ Processed message', { correlationID, payload });
      await producer.send({
        topic: process.env.SEND_TOPIC!,
        messages: [
          {
            headers: {
              correlationID,
            },
            key: correlationID,
            value: JSON.stringify({
              uuid: uuid(),
              username: payload?.username || 'unknown',
              created: new Date(),
            }),
          },
        ],
      });
    },
  });
}

