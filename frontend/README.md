# Dino Transit — Frontend — v1.0

The **v1** browser client: **React 19**, **Vite 7**, **Leaflet**, and **`@stomp/stompjs`**. It draws Lisbon Metro lines, diagram-style stations, animated “dino” sprites, and a trip planner sidebar while consuming the Spring Boot WebSocket feed.

**Read the [repository root README](../README.md) first** for the full story: **why v1 stays Leaflet** (and **Mapbox v2**), **live demo**, **screenshots**, **multimodal roadmap**, **design and accessibility**, **sprite credits**, and how **`TRANSIT_MODE`** on the server affects what you see. This file only covers **running and navigating this package**.

## v1 in one flow

1. **`useTransportData.js`** opens a **native WebSocket** to **`VITE_WS_URL`** or the default **`ws://localhost:8080/ws`**, then subscribes to STOMP topic **`/topic/transport`**.
2. Each message body is a **JSON array** of **`TransportUpdate`** objects (see **[backend/README.md](../backend/README.md)** for the exact fields). The UI drives sprites, the data-source badge, planner “line activity,” and `aria-live` announcements from that batch.
3. **Metro** is the only mode with live map data today; **Bus / Train / Air** open the planner in a **hatching** placeholder state.

## Prerequisites

- **Node.js 20+** (Docker build uses **Node 22**; see `Dockerfile`).
- **npm** and a running **backend** (root [README](../README.md) — **Getting started**).

## Commands

```bash
npm install
npm run dev
```

- Dev server: **http://localhost:5500** (`vite.config.js`).

**Custom broker URL** (Docker, remote backend, or non-default port):

```bash
VITE_WS_URL=ws://localhost:8181/ws npm run dev
```

**Production build** (output directory **`build/`**, used by the Docker image):

```bash
npm run build
npm run preview   # optional: serve the production build locally
```

## Docker

`VITE_WS_URL` is passed as a **build-time** `ARG` in `Dockerfile`. See the root **`docker-compose.yml`** for a working example next to the Java service.

## `src/` layout (high level)

```
src/
├── index.jsx                  # Vite/React entry
├── App.jsx
├── styles/                    # CSS Modules (+ globals.css)
└── components/Map/
    ├── AppShell.jsx           # Layout, planner + map state
    ├── LiveDinoMap.jsx        # Leaflet map composition
    ├── PlannerPanel.jsx       # Routing UI + WIP modes
    ├── MetroStationSelect.jsx # APG-style combobox
    ├── MetroStationSelect.module.css
    ├── LiveAnnouncer.jsx      # aria-live + SR map mirror
    ├── useTransportData.js    # STOMP client + /topic/transport
    ├── data/metroLines.js
    ├── utils/                 # metroNetwork (BFS), stationUtils, stationLabelModel
    └── layers/                # MetroMode, MetroLine, station layers
```

## Tech

- **React 19**, **Vite 7**, **Leaflet 1.9**, **react-leaflet 5**, **`@stomp/stompjs` 7.x**
- **CSS Modules** via the **`@styles`** alias → `src/styles/`
- **Sprites** under `public/assets/sprites/` — full attribution in the root [README](../README.md) **Assets and credits**.

---

**Thank you** for reading the frontend README—if anything here drifts from code, the root **[README](../README.md)** and `src/` are the next places to look.
