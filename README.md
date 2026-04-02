# Dino Transit: Prehistoric Real-Time Mobility

**A real-time style digital twin of Lisbon public transport, shown as dinosaurs on a map.**

The idea is to blend Lisbon public transport with a retro pixel look and live updates from the backend. Spring Boot pushes vehicle positions over WebSockets; the React + Leaflet frontend draws lines, stations, and animated sprites.

**Multimodal roadmap:** I want this app to cover **metro, bus, train, and air** eventually. Metro is the first slice (simulated trains on all four lines); **Bus** (Carris), **Train** (CP), and **Air** are stubbed in the UI for now. Down the line I hope to add a proper **logo or wordmark** for Dino Transit and a **short intro animation** the first time someone visits—nothing built for that yet.

I am still figuring a lot of this out—especially how far to push **WCAG 2.2 AAA** (contrast, focus, screen reader wording) while keeping the Game Boy–ish vibe. The repo includes accessibility notes I treat as a north star, not a finished audit.

![Dino Transit](frontend/public/assets/sprites/brachio_greenline_east_walk.gif) _(Placeholder until I add a real app screenshot.)_

## Architecture

Monorepo:

- **`backend/`** — Spring Boot (Java 21): metro simulation today; GTFS/API ingestion later. WebSocket topic for live updates.
- **`frontend/`** — React (Vite) + Leaflet: map, layers, planner UI, WIP modals for modes that are not wired yet.

## Getting started

**Prerequisites:** Java 21+, Node.js 18+ and npm.

**Backend**

```bash
cd backend
./mvnw spring-boot:run
```

Default: `http://localhost:8080` (override with `PORT` if needed).

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Dev server: `http://localhost:5500`. Point `VITE_WS_URL` at your backend WebSocket URL if it is not the default.

**Docker (optional)**

From the repo root:

```bash
docker compose up --build
```

Compose maps the frontend to port **5500** and expects the backend WebSocket URL baked into the image (see `frontend/Dockerfile` / `docker-compose.yml`).

## Dino fleet (status)

| Mode   | Dino              | Notes                          | Status        |
| ------ | ----------------- | ------------------------------ | ------------- |
| Metro  | Brachiosaurus     | Simulated on all four lines    | Working (sim) |
| Bus    | Triceratops       | Carris                         | WIP           |
| Train  | Ankylosaurus      | CP                             | WIP           |
| Air    | Quetzalcoatlus    |                                | WIP           |

## Design and accessibility (in progress)

- **Look and feel:** I am still harmonizing the pixel sprites, map tiles, and UI chrome so it feels like one Game Boy–inspired system instead of separate pieces. **Dinosaur sprites may change** (recolours, outlines, or replacements) as the app grows.
- **Contrast:** Line colours and sprites were not designed for AAA text contrast; I am experimenting with outlines, label panels, and palette tweaks so important text and icons stay readable on the map.
- **UX / a11y:** Dual-view patterns, natural-language style announcements, and keyboard behaviour are goals I am iterating on—feedback and audits welcome.

## Tech stack

- Backend: Spring Boot 3, STOMP/WebSocket, scheduler
- Frontend: React, Vite, Leaflet, STOMP client
- Assets: pixel sprites (see below)

## Assets and credits

- **Base sprites:** [teaceratops](https://teaceratops.itch.io/) (GB Studio–friendly dino pack). Green line uses those as-is.
- **Recolours:** Blue, red, yellow (and variants) are my palette edits on top of the originals.
- **Egg (WIP modes):** The animated egg on the **Bus, Train, and Air** controls (and in their work-in-progress modal) is from [Pet Egg / Animated by Annivilus](https://annivilus.itch.io/pet-eggs) on itch.io. I use it **as downloaded**—no edits to that asset.
