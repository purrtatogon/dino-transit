# 🗺️ Dino Transit Frontend

A retro-styled dashboard built with **React** and **Leaflet**. It connects to the backend via WebSockets to render a live, animated map of the transit network.

## 🎨 Features

- **Live Map:** Renders moving vehicles on a custom "Pixelated" map style.
- **Sprite Animation:** Handles state changes (Walking vs. Idle) and directional flipping.
- **Layer Control:** Toggle visibility for Metro, Bus, Train, and Air layers.

## 🛠️ Setup & Run

### Prerequisites

- Node.js 18+

### Commands

**Install Dependencies:**

```bash
npm install
```

**Start Development Server:**

```bash
npm run dev
```

**Build for Production:**

```bash
npm run build
```

## Key Components

- **DinoMap.jsx:** Main map container and WebSocket connection manager.
- **layers/:** Logic for individual transport modes (e.g., MetroLayer.jsx).
- **assets/sprites/:** Pixel art assets for the dinosaur fleet.
