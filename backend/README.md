# 🧠 Dino Transit Backend

The orchestration engine for **Dino Transit** — simulates metro trains, broadcasts real-time updates via WebSockets, and (planned) ingests GTFS/API data for Lisbon transit.

## ⚡ Features

- **Metro Simulation:** `JurassicRailService` simulates all four Lisbon Metro lines (Green, Red, Blue, Yellow) with station stops and direction-aware sprites.
- **WebSocket Broadcasting:** Pushes updates every 500ms to `/topic/transport`.
- **Direction Calculation:** Computes east/west/north/south from track geometry for correct sprite orientation.

## 🛠️ Tech Stack

- Spring Boot 3, WebSocket (Stomp), Scheduler

## 🚀 Setup & Run

### Prerequisites

- Java 21+
- Maven (wrapper included: `./mvnw`)

### Commands

```bash
./mvnw spring-boot:run
```

_Server starts on `http://localhost:8080`_

**Run Tests:**

```bash
./mvnw test
```

## 📡 WebSocket API

- **Endpoint:** `ws://localhost:8080/ws`
- **Topic:** `/topic/transport`
- **Payload:** Array of `TransportUpdate` objects.

**TransportUpdate Example:**

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

- **direction:** `"east"` | `"west"` | `"north"` | `"south"` — used for sprite selection.
- **lineColor:** `"green"` | `"red"` | `"blue"` | `"yellow"` — metro line color.

## ⚙️ Configuration

- **application.properties:** `spring.docker.compose.enabled=false` — disables Docker Compose when Docker is not running.
