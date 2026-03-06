# 🗺️ Dino Transit Frontend

The map interface for **Dino Transit** — a real-time digital twin of Lisbon's public transportation, reimagined with dinosaurs. Built with **React**, **Vite**, and **Leaflet**, connecting to the backend via WebSockets.

## 🎨 Features

- **Live Map:** Renders moving Brachiosaurus sprites on a pixel-art style map of Lisbon.
- **4-Direction Sprites:** East, west, north, south — walking and idle states per direction.
- **Layer Control:** Toggle Metro visibility; Bus, Train, and Air show WIP modals.
- **Station Labels:** Pixel-style station signs along the Green line.

## 🛠️ Tech Stack

- React, Vite, Leaflet, SockJS (@stomp/stompjs)

## 🚀 Setup & Run

### Prerequisites

- Node.js 18+ & npm
- Backend running on `http://localhost:8080` (for live data)

### Commands

```bash
npm install
npm run dev
```

_Opens at `http://localhost:5500`_

**Build for Production:**

```bash
npm run build
```

_Output: `build/`_

## 📁 Key Components

- **DinoMap.jsx** — Main map container, WebSocket connection, layer toggles.
- **layers/MetroLayer.jsx** — Renders metro polylines and dino markers.
- **layers/StationLayer.jsx** — Station labels.
- **ui/WipModal.jsx** — Modal for Bus, Train, Air (WIP).
- **data/** — Line coordinates (greenLine, redLine, blueLine, yellowLine).
- **public/assets/sprites/** — Pixel art sprites (see root README → Assets & Credits).
