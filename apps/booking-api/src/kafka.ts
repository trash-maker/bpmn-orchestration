import { Kafka } from 'kafkajs';


export async function registerToKafkaBroker() {
  const clientId = 'booking-api';
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
              name: payload?.name || 'unknown',
              booked: new Date(),
              confirmed: payload !== undefined,
            }),
          },
        ],
      });
    },
  });
}

