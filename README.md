# bpmn-orchestration

[![nodejs-v20.11.0](https://img.shields.io/badge/node-v20.11.0-blue?logo=nodedotjs)](https://nodejs.org/en)
[![nx monorepo](https://img.shields.io/badge/nx-monorepo-blue?logo=nx)](https://nx.dev)
[![docker-compose](https://img.shields.io/badge/docker-compose-blue?logo=docker)](https://docs.docker.com/compose/)
[![zeebe](https://img.shields.io/badge/BPMN-zeebe-blue)](https://camunda.com/platform/zeebe/)

✨ Explore BPMN orchestration of a microservice architecture ✨

 - zeebe as `bpmn` engine
 - define a `zeebe-kafka-worker` allowing integration between kafka broker and the engine

## Requirements
 - `docker` + `docker-compose` installed
 - `node` installed
 - A [dns proxy](https://chromewebstore.google.com/detail/proxy-switchyomega/padekgcemlokbadohgkifijomclgjgif) installed, routing `**.local` hosts to `localhost`

## Setup
Install all needed dependencies:
```
npm install
```

Build all needed docker images:
```
npx nx run-many --target=docker-build --all=true
```

Spin up environment:
```
docker-compose up
```

> ℹ️ [nginxproxy/nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) is used as ingress controller. `VIRTUAL_HOST` and `VIRTUAL_PORT` env variables on services are used ad host-based routing.

Open http://zeebe-play.local/view/deployment in your preferred browser.

Deploy the sample bpmn process `/bpmn/test.bpmn`

Open the loaded process definition and run an instance with following parameters:
```json
{
  "kafka.publishTopic": "REQ_TOPIC",
  "kafka.receiveTopic": "RES_TOPIC",
  "kafka.message": { "payload": { "name": "luke" } }
}
```

See worker publish messages on kafka topic `REQ_TOPIC` with proper `correltionID` header.

```
kafka-console-consumer.sh --bootstrap-server kafka:9092 --from-beginning --topic REQ_TOPIC --property print.key=true --property print.headers=true
```

Publish message on kafka topic `RES_TOPIC` with proper `correltionID` header to see process complete.

```
kafka-console-producer.sh --bootstrap-server kafka:9092 --topic RES_TOPIC --property parse.headers=true

> correlationID:xxxxx "SUCCESS"
```


---
Shared with 💜 by `trash-maker`