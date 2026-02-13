# 🦖 Dino Transit: Prehistoric Real-Time Mobility

**A Real-Time Digital Twin for Public Transportation in Lisbon, reimagined with Dinosaurs.**

This project visualizes the Lisbon Metro, Carris Bus, and Air Traffic networks as a living, breathing prehistoric ecosystem. It leverages **Spring Boot** for real-time data orchestration and **React Leaflet** for a retro-styled map interface.

![Dino Transit Screenshot](frontend/public/assets/sprites/brachiosaurus_walk_green.gif) _(Placeholder: I'll add a real screenshot later!)_

## 🏗️ Architecture

The project is a monorepo containing:

- **`backend/`**: A Spring Boot application (Java 17) that ingests transit data (GTFS/API) and broadcasts updates via WebSockets.
- **`frontend/`**: A React (Vite) application that visualizes the vehicles on a pixel-art style map using Leaflet.

## 🚀 Getting Started

### Prerequisites

- **Java 17+**
- **Node.js 18+** & **npm**

### Quick Start

1.  **Start the Backend (The Brain):**

    ```bash
    cd backend
    ./mvnw spring-boot:run
    ```

    _The server will start on `http://localhost:8080`_

2.  **Start the Frontend (The Map):**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    _Open `http://localhost:5173` (or the port Vite assigns) in your browser._

## 🦕 The Dino-Fleet

| Mode      | Dinosaur           | Behavior                                 | Status                  |
| :-------- | :----------------- | :--------------------------------------- | :---------------------- |
| **Metro** | **Brachiosaurus**  | Follows rail lines; "Idles" at stations. | ✅ **Live (Simulated)** |
| **Bus**   | **Triceratops**    | Roams the streets (Carris API).          | 🚧 _WIP_                |
| **Train** | **Ankylosaurus**   | Heavy rail (CP); turns red on delays.    | 🚧 _WIP_                |
| **Air**   | **Quetzalcoatlus** | Soars over the city.                     | 🚧 _WIP_                |

## 🛠️ Tech Stack

- **Backend:** Spring Boot 3, WebSocket (Stomp), Scheduler
- **Frontend:** React, Vite, Leaflet, SockJS
- **Assets:** Custom Pixel Art Sprites
