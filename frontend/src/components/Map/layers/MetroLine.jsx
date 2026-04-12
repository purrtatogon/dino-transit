import React, { useRef, useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { METRO_LINES } from '../data/metroLines';

const LINE_CASING_COLOR = '#111111';

const CASING_BASE = {
    opacity: 0.95,
    lineCap: 'butt',
    lineJoin: 'miter',
};

const COLOR_BASE = {
    opacity: 1,
    lineCap: 'butt',
    lineJoin: 'miter'
};

const getLineWeights = (zoom) => {
    if (zoom <= 11)   return { casing: 5,  color: 3 };
    if (zoom <= 12)   return { casing: 7,  color: 4 };
    if (zoom <= 13)   return { casing: 9,  color: 5 };
    if (zoom <= 14)   return { casing: 10, color: 6 };
    if (zoom <= 15)   return { casing: 13, color: 8 };
    return { casing: 16, color: 10 };
};

const SPRITE_PX = 48;
const SPRITE_ANCHOR_X = SPRITE_PX / 2;
const SPRITE_ANCHOR_Y = SPRITE_PX;

const METRO_SPEED_DEG_PER_S = 0.0001;
const MOVE_THRESHOLD = 0.00001;
const MIN_ANIM_MS = 1000;
const MAX_ANIM_MS = 10000;
// Simulator ticks ~500ms; long eased animations were constantly cancelled and
// sprites never moved smoothly along the polyline. Keep each step short and linear.
const SIMULATED_MIN_ANIM_MS = 70;
const SIMULATED_MAX_ANIM_MS = 450;

// -- Teleport threshold --
// Live API data sometimes jumps a train across multiple stations in one update.
// If the gap is bigger than this (roughly 3 station spacings), we "teleport"
// the sprite instantly instead of animating it — otherwise it would fly across
// the whole map in a weird straight line.
const TELEPORT_THRESHOLD = 0.015;

// -- Dead-reckoning ("coasting") --
// When a train is "Moving" but the backend hasn't sent a new position for a
// while, we nudge the sprite slowly along its track so it doesn't freeze.
// This hides the irregular timing of live API updates.  When a real update
// arrives the sprite corrects smoothly to the actual position.
const COAST_DELAY_MS = 2000;
const COAST_SPEED_PROGRESS_PER_S = 0.003;

const SPRITE_LOOKUP = Object.fromEntries(
    METRO_LINES.map((line) => [line.key, line.sprites])
);

const getSpriteUrl = (filename) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${window.location.origin}${base}/assets/sprites/${filename}`;
};

/* ── icon cache ── */

const _iconCache = new Map();

// Check reduced-motion preference once at module level.  The SpriteMarker
// component also listens for live changes, but we cache it here so the
// icon cache key separates reduced-motion icons from normal ones.
const reducedMotionMql =
    typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

const isReducedMotion = () => reducedMotionMql?.matches ?? false;

const toIconKey = (isMoving, lineColor, direction) => {
    const color = (lineColor || 'green').toLowerCase();
    const dir = direction || 'east';
    // Under prefers-reduced-motion we never load the walk GIF — animated
    // GIFs bypass CSS animation control and keep playing in the browser's
    // image decoder.  WCAG AAA requires no auto-playing animation.
    const effectiveMoving = isMoving && !isReducedMotion();
    const mode = effectiveMoving ? 'walk' : 'idle';
    const rm = isReducedMotion() ? 'rm' : '';
    return `${color}|${dir}|${mode}${rm}`;
};

const buildDinoIcon = (isMoving, lineColor, direction) => {
    const color = (lineColor || 'green').toLowerCase();
    const dir = direction || 'east';
    const sprites = SPRITE_LOOKUP[color]?.[dir]
        || SPRITE_LOOKUP[color]?.east
        || SPRITE_LOOKUP.green.east;
    // Never load the walk GIF under prefers-reduced-motion
    const effectiveMoving = isMoving && !isReducedMotion();
    const filename = effectiveMoving ? sprites.walk : sprites.idle;

    return L.divIcon({
        className: 'dino-wrapper',
        html: `<img src="${getSpriteUrl(filename)}" class="pixel-dino" alt="${color} dino facing ${dir}" />`,
        iconSize: [SPRITE_PX, SPRITE_PX],
        iconAnchor: [SPRITE_ANCHOR_X, SPRITE_ANCHOR_Y],
        popupAnchor: [0, Math.round(-SPRITE_PX * 0.94)]
    });
};

const getCachedIcon = (isMoving, lineColor, direction) => {
    const key = toIconKey(isMoving, lineColor, direction);
    if (!_iconCache.has(key)) {
        _iconCache.set(key, buildDinoIcon(isMoving, lineColor, direction));
    }
    return _iconCache.get(key);
};

/* ── polyline path utilities ── */

const coordDist = (a, b) => Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);

const buildPathData = (stations) => {
    const coords = stations.map((s) => s.coords);
    const cumDist = [0];
    for (let i = 1; i < coords.length; i++) {
        cumDist.push(cumDist[i - 1] + coordDist(coords[i - 1], coords[i]));
    }
    return { coords, cumDist, totalLength: cumDist[cumDist.length - 1] };
};

const nearestProgress = (pathData, point) => {
    const { coords, cumDist, totalLength } = pathData;
    if (totalLength === 0) return 0;
    let bestDist = Infinity;
    let bestProgress = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        const segLen = coordDist(a, b);
        if (segLen === 0) continue;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (segLen * segLen);
        t = Math.max(0, Math.min(1, t));
        const proj = [a[0] + t * dx, a[1] + t * dy];
        const d = coordDist(proj, point);
        if (d < bestDist) {
            bestDist = d;
            bestProgress = (cumDist[i] + t * segLen) / totalLength;
        }
    }
    return bestProgress;
};

const progressToPos = (pathData, progress) => {
    const { coords, cumDist, totalLength } = pathData;
    if (totalLength === 0) return coords[0];
    const target = Math.max(0, Math.min(1, progress)) * totalLength;
    for (let i = 0; i < coords.length - 1; i++) {
        if (target <= cumDist[i + 1]) {
            const segStart = cumDist[i];
            const segLen = cumDist[i + 1] - segStart;
            const t = segLen === 0 ? 0 : (target - segStart) / segLen;
            return [
                coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
                coords[i][1] + t * (coords[i + 1][1] - coords[i][1])
            ];
        }
    }
    return coords[coords.length - 1];
};

const trackDirection = (pathData, fromProgress, toProgress) => {
    const from = progressToPos(pathData, fromProgress);
    const to = progressToPos(pathData, toProgress);
    const dLat = to[0] - from[0];
    const dLng = to[1] - from[1];
    if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) return null;
    return Math.abs(dLat) > Math.abs(dLng)
        ? (dLat > 0 ? 'north' : 'south')
        : (dLng > 0 ? 'east' : 'west');
};

const LINE_PATHS = Object.fromEntries(
    METRO_LINES.map((line) => [line.key, buildPathData(line.stations)])
);

const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const linear = (t) => t;

/* ── SpriteMarker ────────────────────────────────────────
   Imperatively creates a Leaflet marker (returns null in React).
   The marker is always placed in the 'metroTrainSpritesPane' pane
   regardless of where this component sits in the React tree.
   Icon (walk/idle) is driven by animation state, not backend.
   Animation duration scales with distance at realistic metro speed.

   Two important behaviours help smooth over irregular live data:
     1. Teleport threshold – if the backend jumps a train too far in one
        update, snap instead of animating (avoids "flying across the map").
     2. Dead reckoning – when the train is "Moving" but no new positions
        arrive for a while, nudge the sprite slowly along the track so it
        doesn't freeze in place.  Real transit apps (Citymapper, Transit)
        do exactly this to hide gaps in live feeds. */

const SpriteMarker = ({ train }) => {
    const map = useMap();
    const markerRef = useRef(null);
    const stateRef = useRef({
        targetLat: null,
        targetLng: null,
        rafId: null,
        coastTimerId: null,
        coastRafId: null,
        direction: train.direction || 'east',
        // Track-progress of the sprite's current rendered position (0..1).
        // Needed by dead-reckoning so the sprite knows where it is on the
        // polyline and can "drift" forward.
        currentProgress: null,
        // Which way along the polyline are we going? +1 = forward, -1 = back.
        progressDirection: 1,
    });
    const iconKeyRef = useRef('');

    const lineKey = (train.lineColor || 'green').toLowerCase();
    const pathData = LINE_PATHS[lineKey];

    // Helper: update the Leaflet icon only when the visual key changes so we
    // don't re-create the DOM element every frame.
    const syncIcon = (isMoving, direction) => {
        const marker = markerRef.current;
        if (!marker) return;
        const dir = direction || stateRef.current.direction || 'east';
        const key = toIconKey(isMoving, train.lineColor, dir);
        if (key !== iconKeyRef.current) {
            marker.setIcon(getCachedIcon(isMoving, train.lineColor, dir));
            iconKeyRef.current = key;
        }
    };

    // Helper: cancel any running animation AND any pending coast timer/raf.
    const cancelAll = () => {
        const state = stateRef.current;
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        if (state.coastTimerId) { clearTimeout(state.coastTimerId); state.coastTimerId = null; }
        if (state.coastRafId) { cancelAnimationFrame(state.coastRafId); state.coastRafId = null; }
    };

    // -- Dead reckoning: start drifting along the track after a pause --
    // We only start this when the last update said "Moving" because a
    // "Boarding" train should stay still at its station.
    const startCoast = () => {
        const state = stateRef.current;
        if (!pathData || state.currentProgress === null) return;

        const dir = state.progressDirection;
        const startP = state.currentProgress;
        const t0 = performance.now();

        syncIcon(true, state.direction);

        const tick = (now) => {
            const elapsed = (now - t0) / 1000;
            const newP = Math.max(0, Math.min(1, startP + dir * COAST_SPEED_PROGRESS_PER_S * elapsed));
            const pos = progressToPos(pathData, newP);
            markerRef.current?.setLatLng(pos);
            state.currentProgress = newP;

            // Stop drifting if we hit the end/start of the line
            if (newP <= 0 || newP >= 1) {
                state.coastRafId = null;
                syncIcon(false, state.direction);
                return;
            }
            state.coastRafId = requestAnimationFrame(tick);
        };
        state.coastRafId = requestAnimationFrame(tick);
    };

    // After an animation finishes, optionally queue a coast.
    const onAnimationDone = () => {
        const state = stateRef.current;
        syncIcon(false, state.direction);

        // Only coast when the train is supposed to be moving
        const isMoving = (train.status || '').toLowerCase() !== 'boarding';
        if (!isMoving || !pathData) return;

        // Live data has a built-in ~5s cache plateau on the Metro Lisboa API.
        // Start coasting right away so the sprite doesn't freeze between real
        // updates.  Simulated/schedule data arrives more regularly, so we give
        // it the normal delay before assuming we need to coast.
        const delay = train.source === 'live' ? 0 : COAST_DELAY_MS;
        state.coastTimerId = setTimeout(() => {
            state.coastTimerId = null;
            startCoast();
        }, delay);
    };

    // ── Mount/unmount the Leaflet marker ──
    useEffect(() => {
        const icon = getCachedIcon(false, train.lineColor, train.direction);
        const marker = L.marker([train.latitude, train.longitude], {
            icon,
            pane: 'metroTrainSpritesPane'
        }).addTo(map);
        marker.bindPopup(
            `<strong>${train.dinoName}</strong><br/>Status: ${train.status}`
        );
        markerRef.current = marker;
        iconKeyRef.current = toIconKey(false, train.lineColor, train.direction);
        stateRef.current.targetLat = train.latitude;
        stateRef.current.targetLng = train.longitude;
        stateRef.current.direction = train.direction || 'east';
        if (pathData) {
            stateRef.current.currentProgress = nearestProgress(
                pathData, [train.latitude, train.longitude]
            );
        }

        return () => {
            cancelAll();
            map.removeLayer(marker);
            markerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, train.dinoName]);

    // ── Keep popup content in sync ──
    useEffect(() => {
        markerRef.current?.getPopup()?.setContent(
            `<strong>${train.dinoName}</strong><br/>Status: ${train.status}`
        );
    }, [train.status, train.dinoName]);

    // ── Visual staleness indicator ──
    // When the backend is serving cached (stale) data, dim the sprite so
    // the user can tell at a glance that this position may be outdated.
    useEffect(() => {
        const el = markerRef.current?.getElement();
        if (!el) return;
        el.style.opacity = train.source === 'cached' ? '0.5' : '1';
        el.style.transition = 'opacity 0.4s ease';
    }, [train.source]);

    // ── Respect prefers-reduced-motion mid-session ──
    useEffect(() => {
        const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (!mql?.addEventListener) return;

        const handleChange = () => {
            // Flush icon cache so icons rebuild with the correct walk/idle
            // choice — animated GIFs must never be loaded when the user
            // activates reduced motion.
            _iconCache.clear();

            const state = stateRef.current;
            cancelAll();
            if (markerRef.current && state.targetLat !== null) {
                markerRef.current.setLatLng([state.targetLat, state.targetLng]);
                syncIcon(false, state.direction);
            }
        };

        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);

    // ── Main position-update effect ──
    // Runs every time the backend sends new coordinates for this train.
    useEffect(() => {
        const marker = markerRef.current;
        if (!marker) return;
        const state = stateRef.current;

        const destLat = train.latitude;
        const destLng = train.longitude;
        const isSimulated = train.source === 'simulated';

        // Always keep our internal target in sync with the backend, even when
        // the change is tiny.  Previously we returned early here without
        // updating state, which caused gradual drift over many sub-threshold
        // ticks (especially with schedule data that lerps in tiny increments).
        state.targetLat = destLat;
        state.targetLng = destLng;

        // Skip *animation* if position hasn't meaningfully changed
        if (
            Math.abs((marker.getLatLng().lat) - destLat) < MOVE_THRESHOLD &&
            Math.abs((marker.getLatLng().lng) - destLng) < MOVE_THRESHOLD
        ) {
            return;
        }

        // Cancel any running animation or coast — a real update takes priority
        cancelAll();

        // When a train is stopped at a station ("Boarding"), snap straight to
        // the station coordinates and show the idle PNG.  Without this, every
        // 500ms backend tick would cancel the running animation mid-way and
        // restart it, keeping the walk GIF visible indefinitely because
        // onAnimationDone() (which sets idle) never fires.
        const isBoarding = (train.status || '').toLowerCase() === 'boarding';
        if (isBoarding) {
            marker.setLatLng([destLat, destLng]);
            syncIcon(false, state.direction);
            if (pathData) {
                state.currentProgress = nearestProgress(pathData, [destLat, destLng]);
            }
            return;
        }

        // Respect user preference: no animation, just snap
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            marker.setLatLng([destLat, destLng]);
            syncIcon(false, state.direction);
            if (pathData) {
                state.currentProgress = nearestProgress(pathData, [destLat, destLng]);
            }
            return;
        }

        const origin = marker.getLatLng();
        const dist = coordDist([origin.lat, origin.lng], [destLat, destLng]);

        // -- Teleport check --
        // If the backend jumped the train too far (e.g. the live API sent a
        // completely different station), snap instantly.  Trying to animate
        // across half the metro network would look broken.
        if (dist > TELEPORT_THRESHOLD) {
            marker.setLatLng([destLat, destLng]);

            // Derive direction from the actual origin→destination segment on
            // the track, not the whole-line start→end which was always the
            // same fixed direction regardless of where the train is.
            if (pathData) {
                const fromP = nearestProgress(pathData, [origin.lat, origin.lng]);
                const toP = nearestProgress(pathData, [destLat, destLng]);
                const dir = trackDirection(pathData, fromP, toP);
                if (dir) state.direction = dir;
                state.currentProgress = toP;
            } else if (train.direction) {
                state.direction = train.direction;
            }

            // After a teleport the position is uncertain — don't coast forward
            // from here.  Just idle until the next real update arrives.
            syncIcon(false, state.direction);
            return;
        }

        // -- Path-following animation --
        // Project both current and target positions onto the polyline and
        // animate along it.  This keeps the sprite on the tracks instead of
        // cutting diagonally across streets.
        if (pathData) {
            const fromP = nearestProgress(pathData, [origin.lat, origin.lng]);
            const toP = nearestProgress(pathData, [destLat, destLng]);
            const trackDist = Math.abs(toP - fromP) * pathData.totalLength;

            const rawDurationMs = Math.max(
                MIN_ANIM_MS,
                Math.min(MAX_ANIM_MS, (trackDist / METRO_SPEED_DEG_PER_S) * 1000)
            );
            const durationMs = isSimulated
                ? Math.max(
                    SIMULATED_MIN_ANIM_MS,
                    Math.min(SIMULATED_MAX_ANIM_MS, rawDurationMs * 0.35)
                )
                : rawDurationMs;

            const dir = trackDirection(pathData, fromP, toP);
            if (dir) state.direction = dir;
            state.progressDirection = toP >= fromP ? 1 : -1;

            syncIcon(true, state.direction);
            const t0 = performance.now();
            const easeFn = isSimulated ? linear : easeInOutCubic;

            const tick = (now) => {
                const p = Math.min((now - t0) / durationMs, 1);
                const e = easeFn(p);
                const prog = fromP + (toP - fromP) * e;
                const pos = progressToPos(pathData, prog);
                marker.setLatLng(pos);
                state.currentProgress = prog;

                if (p < 1) {
                    state.rafId = requestAnimationFrame(tick);
                } else {
                    state.rafId = null;
                    onAnimationDone();
                }
            };
            state.rafId = requestAnimationFrame(tick);
            return;
        }

        // -- Straight-line fallback (no path data) --
        const rawLineMs = Math.max(
            MIN_ANIM_MS,
            Math.min(MAX_ANIM_MS, (dist / METRO_SPEED_DEG_PER_S) * 1000)
        );
        const durationMs = isSimulated
            ? Math.max(
                SIMULATED_MIN_ANIM_MS,
                Math.min(SIMULATED_MAX_ANIM_MS, rawLineMs * 0.35)
            )
            : rawLineMs;
        const sLat = origin.lat;
        const sLng = origin.lng;
        syncIcon(true, state.direction);
        const t0 = performance.now();
        const easeFn = isSimulated ? linear : easeInOutCubic;

        const tick = (now) => {
            const p = Math.min((now - t0) / durationMs, 1);
            const e = easeFn(p);
            marker.setLatLng([
                sLat + (destLat - sLat) * e,
                sLng + (destLng - sLng) * e
            ]);
            if (p < 1) {
                state.rafId = requestAnimationFrame(tick);
            } else {
                state.rafId = null;
                onAnimationDone();
            }
        };
        state.rafId = requestAnimationFrame(tick);
    }, [train.latitude, train.longitude, train.lineColor, train.direction, train.status, train.source]);

    return null;
};

/* ── MetroLine ───────────────────────────────────────────
   Renders one metro line: the casing polyline, the colored
   polyline, and a SpriteMarker for each dino on this line.
   Expects to be rendered inside a <Pane> for the polylines.
   SpriteMarkers place themselves in 'metroTrainSpritesPane'
   imperatively, so they end up in the right pane regardless. */

const MetroLine = ({ line, trains, zoom }) => {
    const weights = getLineWeights(zoom);

    return (
        <>
            <Polyline
                positions={line.stations.map((s) => s.coords)}
                pathOptions={{ ...CASING_BASE, weight: weights.casing, color: LINE_CASING_COLOR }}
            />
            <Polyline
                positions={line.stations.map((s) => s.coords)}
                pathOptions={{ ...COLOR_BASE, weight: weights.color, color: line.color }}
            />
            {trains.map((train) => (
                <SpriteMarker key={train.dinoName} train={train} />
            ))}
        </>
    );
};

export default MetroLine;
