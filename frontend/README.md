# Dino Transit — Frontend

React + Vite + Leaflet map for **Dino Transit**: live metro dinosaurs, station geometry, and a planner-style sidebar. Connects to the Spring Boot app over WebSockets.

Long term I want the app to be **multimodal** (metro, bus, train, air). Metro ships first; the other modes are placeholders until real data and sprites are wired up. I also hope to add a **Dino Transit logo or wordmark** and a **small first-visit animation** later—still on the wish list.

## What it does today

- Draws the four Lisbon Metro lines with **casing** on the polylines and **per-line** sprites (walk / idle, four directions).
- **Station nodes** (`StationNodesLayer`) and **diagram-style labels** (`StationLabelsLayer`) with layout shared in `layers/stationLayerShared.js`.
- **Mode toggles:** Metro is live; Bus, Train, and Air use the same **pet egg** sprite on the buttons and in the WIP modal—that asset is from [Annivilus — Pet Egg / Animated](https://annivilus.itch.io/pet-eggs), used **unaltered** (see root README for full credits).
- **Styling:** CSS Modules (`*.module.css`) plus a small amount of global CSS for fonts and legacy dialog hooks.

## What I am still working on

- Making the **pixel / Game Boy aesthetic** line up with the rest of the UI (typography, panels, map chrome).
- **WCAG AAA–oriented** choices: label contrast on top of map tiles, focus order, reduced motion, and how much “transit app” copy to put into ARIA—this is exploratory, not a certified audit.
- **Sprite contrast** on busy backgrounds (outlines, backgrounds, maybe re-exporting assets).
- **Brachiosaurus / line sprites** may get further tweaks or replacements as multimodal features land.

## Tech

- React, Vite, Leaflet, `@stomp/stompjs`

## Run locally

**Needs the backend** on the WebSocket URL you configure (default in code targets `ws://localhost:8080/ws` unless `VITE_WS_URL` is set).

```bash
npm install
npm run dev
```

Opens on port **5500** (see `vite.config.js`).

**Production build**

```bash
npm run build
```

Output directory: `build/` (used by the Docker image).

## Docker note

The `Dockerfile` accepts `VITE_WS_URL` at build time (see repo root `docker-compose.yml` for an example).

## Main files

- `src/components/Map/DinoMap.jsx` — map shell, WebSocket, toggles, planner.
- `src/components/Map/layers/MetroLayer.jsx` — lines and train markers.
- `src/components/Map/layers/StationNodesLayer.jsx` — clickable station squares.
- `src/components/Map/layers/StationLabelsLayer.jsx` — schematic labels and leaders.
- `src/components/Map/data/*.js` — stop coordinates per line.
- `src/components/ui/WipModal.jsx` — WIP modes.
- `public/assets/sprites/` — sprite sheets; **dinos** (teaceratops + my recolours) and **egg** (Annivilus, unchanged). Full credits in root README.
