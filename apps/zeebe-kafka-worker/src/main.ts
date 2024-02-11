import { IInputVariables, ZBClient } from 'zeebe-node';

type Message = {
  headers: { [key: string]: string };
  payload: { [key: string]: unknown };
};

const generateUUID = (length = 32): string =>
  Array(length)
    .fill('')
    .map((v) => Math.random().toString(16).charAt(2))
    .join('');

function toMessage(variables: Readonly<IInputVariables>): Message {
  const headers = Object.fromEntries(
    Object.entries(variables)
      .filter(([key, value]) => key.startsWith('kafka.header.'))
      .map(([key, value]) => [key.substring('kafka.header.'.length), value])
  );

  const payload = Object.fromEntries(
    Object.entries(variables)
      .filter(([key, value]) => key.startsWith('kafka.payload.'))
      .map(([key, value]) => [key.substring('kafka.payload.'.length), value])
  );
  return { headers, payload };
}

async function kafkaSendReceive(message: Message, publishTopic, receiveTopic) {
  message.headers.correlationID = generateUUID();

  // simulate publish message
  console.log(`send message to topic ${publishTopic}:`, message);

  // simulate subscribe and receive response message (same correlationID)
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const response: Message = {
    headers: message.headers,
    payload: { processed: true, timestamp: new Date() },
  };

  return response;
}

function init() {
  // Instantiate a Zeebe client with default localhost settings or environment variables
  const zbc = new ZBClient();

  console.log('Creating worker...');

  // Create a Zeebe worker to handle the 'kafka' service task
  const worker = zbc.createWorker({
    // Define the task type that this worker will process
    taskType: 'kafka',
    // Define the task handler to process incoming jobs
    taskHandler: async (job) => {
      // Log the job variables for debugging purposes
      console.log(job.variables);

      if (!('kafka.publish-topic' in job.variables)) {
        return job.error(
          'NO_TOPIC',
          'Missing "kafka.publish-topic" in process variables'
        );
      }
      if (!('kafka.ack-topic' in job.variables)) {
        return job.error('NO_TOPIC', 'Missing "kafka.ack-topic" in process variables');
      }

      const publishTopic = job.variables['kafka.publish-topic'] as string;
      const receiveTopic = job.variables['kafka.ack-topic'] as string;

      const response = await kafkaSendReceive(
        toMessage(job.variables),
        publishTopic,
        receiveTopic
      );

      console.log('complete');
      return job.complete(response);
    },
  });

  worker.on('ready', () => console.log('kafka worker up & ready.'));
  worker.on('close', () => console.log('kafka worker shut down successfully.'));
  worker.on('connectionError', () =>
    console.error('kafka worker connection error!')
  );
}

init();