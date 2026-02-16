# 🧠 Dino Transit Backend

The core orchestration engine for the Dino Transit ecosystem. This service simulates vehicle movements, ingests real-time API data, and broadcasts synchronized updates to connected clients.

## ⚡ Features

- **Real-Time Simulation:** `JurassicRailService` simulates Metro trains with realistic physics (acceleration, station stops).
- **WebSocket Broadcasting:** Pushes updates every 500ms to `/topic/transport`.
- **GTFS Integration:** (Planned) Ingests standard transit feeds for accurate scheduling.

## 🛠️ Setup & Run

### Prerequisites

- Java 17 or higher
- Maven (Wrapper included)

### Commands

**Run the Application:**

```bash
./mvnw spring-boot:run
```

**Run Tests:**

```bash
./mvnw test
```

## API Endpoints

- **WebSocket:** ws://localhost:8080/ws
- **Topic:** /topic/transport
- **Payload Example:**

```json
{
  "type": "Metro",
  "dinoName": "Metro-01",
  "status": "Moving",
  "latitude": 38.706,
  "longitude": -9.144
}
```
