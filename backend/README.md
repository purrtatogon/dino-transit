# Dino Transit — Backend

Spring Boot service for **Dino Transit**: simulates metro trains on all four lines, computes direction from track geometry, and broadcasts `TransportUpdate` payloads over WebSockets.

Real GTFS / API ingestion is still on the roadmap; right now the metro loop is **simulated** so the frontend can be exercised end-to-end.

## Features

- **Metro simulation** — `JurassicRailService` updates positions on a schedule and emits STOMP messages on `/topic/transport`.
- **Directions** — `east` / `west` / `north` / `south` for sprite selection.
- **Configurable port** — `server.port=${PORT:8080}` in `application.properties` (Docker Compose uses `8181` in the sample root file).

## Stack

Spring Boot 3, WebSocket message broker (STOMP), scheduled tasks.

## Run

**Prerequisites:** Java 21+.

```bash
./mvnw spring-boot:run
```

**Tests**

```bash
./mvnw test
```

## WebSocket API

- **Endpoint:** `/ws` (plain WebSocket and SockJS registered on the same path—see `WebSocketConfig`).
- **Broker topic:** `/topic/transport`
- **Payload:** JSON array of `TransportUpdate` records.

Example object:

```json
{
  "type": "Metro",
  "dinoName": "Metro-G-S1",
  "status": "Moving",
  "latitude": 38.742,
  "longitude": -9.144,
  "direction": "south",
  "lineColor": "green"
}
```

- `direction`: `"east"` | `"west"` | `"north"` | `"south"`
- `lineColor`: `"green"` | `"red"` | `"blue"` | `"yellow"`

## Configuration

- `spring.docker.compose.enabled=false` — avoids failing startup when Docker Compose is not running.
- `PORT` — optional env var to override the default HTTP port.

## Docker

The backend ships with a `Dockerfile` in this folder; the repo root `docker-compose.yml` shows one way to run it next to the frontend.
