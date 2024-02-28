import express from 'express';
import * as path from 'path';
import { registerToKafkaBroker } from './kafka';

registerToKafkaBroker();

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
const router = express.Router();

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/health', (req, res) => {
  const address = server.address();
  console.log('health check', address);
  res.json({ status: 'UP' });
});

router.use(express.json());

app.use('/api', router);

const server = app.listen(port, host, () => {
  console.log(
    `🎉 users-api up and ready, listening at http://${host}:${port}`
  );
});
