import { Duration, ZBClient } from 'zeebe-node';
import { KafkaService, Message } from './kafka';

function uuid(length = 32): string {
  return Array(length)
    .fill('')
    .map((v) => Math.random().toString(16).charAt(2))
    .join('');
}

// Instantiate a Zeebe client with default localhost settings or environment variables
const zbc = new ZBClient();

// Instantiate a Kafka client with default localhost settings or environment variables
const kafka = new KafkaService({
  clientId: `zeebe-kafka-worker-${uuid()}`,
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

async function kafkaSendReceive(
  correlationID: string,
  message: Message,
  publishTopic,
  receiveTopic
) {
  message.headers = Object.assign(message.headers || {}, {
    correlationID,
  });

  console.log(
    `send message for correlationID: ${correlationID} to topic ${publishTopic}:`,
    message
  );
  await kafka.send(publishTopic, {
    headers: message.headers,
    key: correlationID,
    payload: JSON.stringify(message.payload),
  });

  // simulate subscribe and receive response message (same correlationID)
  // await new Promise((resolve) => setTimeout(resolve, 5000));
  // const response: Message = {
  //   headers: message.headers,
  //   payload: { processed: true, timestamp: new Date() },
  // };

  const response = await kafka.receive(
    receiveTopic,
    (message) => message.headers.correlationID === correlationID
  );
  console.log(`completing job for correlatonID: ${correlationID}`);
  try {
    zbc.completeJob({
      jobKey: correlationID,
      variables: {
        'kafka.response': response,
      },
    });
  } catch (error) {
    console.error(
      `cannot complete job for correlationID: ${correlationID}`,
      error
    );
  }

  // TODO handle timeouts & errors
  // message$.removeListener(receiveTopic, listener);
  // zbc.throwError({
  //   jobKey: correlationID,
  //   errorCode: 'TIMED_OUT',
  //   errorMessage: 'Timeout happened.',
  // });
}

async function setup() {
  await kafka.setup(process.env.LISTEN_TOPICS);

  console.log('kafka worker up & ready.');
}

async function teardown() {
  await kafka.teardown();

  console.log('kafka worker shut down successfully.');
}

async function init() {
  console.log('Creating worker...');

  // Create a Zeebe worker to handle the 'kafka' service task
  const worker = zbc.createWorker<{
    'kafka.publishTopic': string;
    'kafka.receiveTopic': string;
    'kafka.message': Message;
  }>({
    // Define the task type that this worker will process
    taskType: 'kafka',
    failProcessOnException: true,
    timeout: Duration.hours.of(1), // 1h timeout
    // Define the task handler to process incoming jobs
    taskHandler: (job) => {
      const { key, variables } = job;
      // Log the job variables for debugging purposes
      console.log(job.variables);

      if (!variables['kafka.publishTopic']) {
        return job.error(
          'NO_TOPIC',
          'Missing "kafka.publishTopic" in process variables'
        );
      }
      if (!variables['kafka.receiveTopic']) {
        return job.error(
          'NO_TOPIC',
          'Missing "kafka.receiveTopic" in process variables'
        );
      }

      const publishTopic = variables['kafka.publishTopic'];
      const receiveTopic = variables['kafka.receiveTopic'];
      const message = variables['kafka.message'];

      kafkaSendReceive(key, message, publishTopic, receiveTopic);

      return job.forward();
    },
  });

  worker.on('ready', setup);
  worker.on('close', teardown);
  worker.on('connectionError', () =>
    console.error('kafka worker connection error!')
  );
}

init();

// kafka-topics.sh --bootstrap-server kafka:9092 --list
// kafka-console-consumer.sh --bootstrap-server kafka:9092 --from-beginning --topic REQ_TOPIC --property print.key=true --property print.headers=true
// kafka-console-producer.sh --bootstrap-server kafka:9092 --topic RES_TOPIC --property parse.headers=true
