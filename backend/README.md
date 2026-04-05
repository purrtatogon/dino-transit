# Dino Transit — Backend — v1.0

Spring Boot **4** (Java **21**) service: selects a **`TRANSIT_MODE`**, normalizes vehicles into **`TransportUpdate`** records, and broadcasts them on **STOMP** topic **`/topic/transport`** on a fixed schedule.

**Read the [repository root README](../README.md) first** for the product narrative: **v1 vs v2**, **why simulator is the default**, **live demo**, **screenshots**, shared **design and accessibility** notes, and the **transit mode matrix** with smoke-test expectations. This file documents **API shape**, **configuration**, and **how to run the JVM service**.

## v1 responsibilities

- **`ConfiguredTransportUpdateSource`** picks **simulator**, **Metro Lisboa**, **GTFS-Realtime** (+ static GTFS), or **schedule** pseudo-realtime.
- **`RealTimeService`** publishes the latest batch to **`/topic/transport`** every **`TRANSIT_BROADCAST_FIXED_RATE_MS`** (default **500** ms).
- **Fallbacks** (simulator / schedule / last-known-good) keep the feed useful when live endpoints fail—see env table below.

## Stack & run

|        |                                    |
| ------ | ---------------------------------- |
| Stack  | Spring Boot 4, STOMP broker, scheduler, Jackson, GTFS-RT bindings |
| Port   | **`server.port`** from **`PORT`** or **8080** (`application.properties`) |
| Tests  | `./mvnw test`                      |

```bash
cd backend
./mvnw spring-boot:run
```

Default **`TRANSIT_MODE`** is **`simulator`** (no API keys). Override with environment variables (see root [README](../README.md) matrix and examples).

## WebSocket API

|            |                                                              |
| ---------- | ------------------------------------------------------------ |
| **STOMP**  | Connect to **`/ws`** (native WebSocket **or** SockJS on the same path—`WebSocketConfig`). |
| **Topic**  | Subscribe to **`/topic/transport`**.                         |
| **Body**   | JSON **array** of **`TransportUpdate`** objects (may be empty). |

**`TransportUpdate` fields** (each element):

| Field | Purpose |
| ----- | ------- |
| `type` | e.g. `"Metro"` |
| `dinoName` | Stable id / label for the vehicle |
| `status` | e.g. `"Moving"`, `"Boarding"` |
| `latitude`, `longitude` | WGS-84 |
| `direction` | `"east"` \| `"west"` \| `"north"` \| `"south"` (sprite facing) |
| `lineColor` | `"green"` \| `"red"` \| `"blue"` \| `"yellow"` |
| `timestampEpochMs` | When the position was produced (freshness / interpolation) |
| `source` | `"live"` \| `"simulated"` \| `"cached"` \| `"schedule"` (UI badge + client hints) |

Example element:

```json
{
  "type": "Metro",
  "dinoName": "Metro-G-S1",
  "status": "Moving",
  "latitude": 38.742,
  "longitude": -9.144,
  "direction": "south",
  "lineColor": "green",
  "timestampEpochMs": 1710000000000,
  "source": "simulated"
}
```

## Configuration (env vars)

Spring maps **`TRANSIT_*`**, **`METROLISBOA_*`**, and related keys from [`application.properties`](src/main/resources/application.properties). The table below is a **highlights** subset; open that file for the complete list and defaults.

| Env var | Default | Notes |
| --- | --- | --- |
| `TRANSIT_MODE` | `simulator` | `metrolisboa`, `gtfs`, `schedule`, or `simulator` |
| `TRANSIT_BROADCAST_FIXED_RATE_MS` | `500` | Publish cadence |
| `TRANSIT_GTFS_ENABLED` | `true` | GTFS subsystem on/off |
| `TRANSIT_GTFS_STATIC_PATH` | empty | Extracted static GTFS folder |
| `TRANSIT_GTFS_VEHICLE_POSITIONS_URL` | empty | GTFS-RT VehiclePositions protobuf URL |
| `TRANSIT_GTFS_TRIP_UPDATES_URL` | empty | Optional TripUpdates (dwell / boarding) |
| `TRANSIT_METROLISBOA_ENABLED` | `false` | Must be `true` for **`metrolisboa`** mode |
| `METROLISBOA_*` | — | Base URL, OAuth/token fields, timeouts, optional insecure SSL (dev only) |
| `TRANSIT_FALLBACK_*` | see `application.properties` | Schedule / simulator / last-known-good fallbacks |

Copy-paste examples for each mode live in the root [README](../README.md) (**Backend transit modes**).

## Docker

This folder has a **`Dockerfile`**. Root **`docker-compose.yml`** wires it beside the frontend: backend **`8181`**, host port **`5500`** mapped to nginx **`80`** on the frontend container.

---

**Thank you** for reading the backend README—for architecture diagrams and credits, stay on the root **[README](../README.md)**.
