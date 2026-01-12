import React, { useRef, useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { METRO_LINES } from '../data/metroLines';
import {
    COAST_DELAY_MS,
    COAST_SPEED_PROGRESS_PER_S,
    MAX_ANIM_MS,
    METRO_SPEED_DEG_PER_S,
    MIN_ANIM_MS,
    MOVE_THRESHOLD,
    SIMULATED_MAX_ANIM_MS,
    SIMULATED_MIN_ANIM_MS,
    TELEPORT_THRESHOLD
} from '../utils/spriteMotionFromTelemetry';

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

const SPRITE_LOOKUP = Object.fromEntries(
    METRO_LINES.map((line) => [line.key, line.sprites])
);

const getSpriteUrl = (filename) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${window.location.origin}${base}/assets/sprites/${filename}`;
};

/* icon cache keyed by sprite variant */

const _iconCache = new Map();

// Snapshot reduced-motion once; SpriteMarker listens for toggles too, but icons need distinct cache keys here.
const reducedMotionMql =
    typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

const isReducedMotion = () => reducedMotionMql?.matches ?? false;

const toIconKey = (isMoving, lineColor, direction) => {
    const color = (lineColor || 'green').toLowerCase();
    const dir = direction || 'east';
    // Reduced motion users never get the walk GIF - GIFs animate on their own and I can't pause them cleanly.
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
    // Same rule inside the icon factory
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

/* polyline helpers for snapping sprites to track geometry */

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

/* SpriteMarker — Leaflet marker lives outside React reconciliation.
   Tweaks imported from spriteMotionFromTelemetry.js.
   Pane = metroTrainSpritesPane so dinosaurs stay above rails.
   Big two hacks for ugly live data:
     1) Teleport when the backend jumps insane distances.
     2) "Coast" slowly along the line if Moving but packets stalled (Metro API caches ~5s). */

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
        // 0-1 slot on the polyline for coast logic
        currentProgress: null,
        // Forward vs reverse along the metro path
        progressDirection: 1,
    });
    const iconKeyRef = useRef('');

    const lineKey = (train.lineColor || 'green').toLowerCase();
    const pathData = LINE_PATHS[lineKey];

    // Only swap icons when walk/idle/direction actually changes (Leaflet hates DOM thrash).
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

    // Kill rAF + coast timers whenever we need a clean slate
    const cancelAll = () => {
        const state = stateRef.current;
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        if (state.coastTimerId) { clearTimeout(state.coastTimerId); state.coastTimerId = null; }
        if (state.coastRafId) { cancelAnimationFrame(state.coastRafId); state.coastRafId = null; }
    };

    // Coast = fake slide along the rails when packets pause (only if status isn't Boarding).
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

            // Bail at line ends
            if (newP <= 0 || newP >= 1) {
                state.coastRafId = null;
                syncIcon(false, state.direction);
                return;
            }
            state.coastRafId = requestAnimationFrame(tick);
        };
        state.coastRafId = requestAnimationFrame(tick);
    };

    // Idle sprite after move; maybe schedule coast
    const onAnimationDone = () => {
        const state = stateRef.current;
        syncIcon(false, state.direction);

        // Boarding trains shouldn't coast
        const isMoving = (train.status || '').toLowerCase() !== 'boarding';
        if (!isMoving || !pathData) return;

        // Metro live batches sit on ~5s cache; start coast immediately there. Sim/schedule can wait.
        const delay = train.source === 'live' ? 0 : COAST_DELAY_MS;
        state.coastTimerId = setTimeout(() => {
            state.coastTimerId = null;
            startCoast();
        }, delay);
    };

    // Create/remove real Leaflet marker (keyed on dino id)
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

    // Popup text
    useEffect(() => {
        markerRef.current?.getPopup()?.setContent(
            `<strong>${train.dinoName}</strong><br/>Status: ${train.status}`
        );
    }, [train.status, train.dinoName]);

    // Dim cached ("stale replay") sprites
    useEffect(() => {
        const el = markerRef.current?.getElement();
        if (!el) return;
        el.style.opacity = train.source === 'cached' ? '0.5' : '1';
        el.style.transition = 'opacity 0.4s ease';
    }, [train.source]);

    // User flips OS reduced-motion mid session - nuke cache so walk GIFs can't sneak back in
    useEffect(() => {
        const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (!mql?.addEventListener) return;

        const handleChange = () => {
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

    // Every backend tick for this dinosaur
    useEffect(() => {
        const marker = markerRef.current;
        if (!marker) return;
        const state = stateRef.current;

        const destLat = train.latitude;
        const destLng = train.longitude;
        const isSimulated = train.source === 'simulated';

        // Keep ref targets accurate even on micro-moves (I had drift bugs when I bailed early here).
        state.targetLat = destLat;
        state.targetLng = destLng;

        // Don't animate jitter smaller than MOVE_THRESHOLD
        if (
            Math.abs((marker.getLatLng().lat) - destLat) < MOVE_THRESHOLD &&
            Math.abs((marker.getLatLng().lng) - destLng) < MOVE_THRESHOLD
        ) {
            return;
        }

        // Fresh server packet wins over any in-flight tween
        cancelAll();

        // Boarding = park at coords + idle art (otherwise WS spam cancels tween forever and GIF never stops).
        const isBoarding = (train.status || '').toLowerCase() === 'boarding';
        if (isBoarding) {
            marker.setLatLng([destLat, destLng]);
            syncIcon(false, state.direction);
            if (pathData) {
                state.currentProgress = nearestProgress(pathData, [destLat, destLng]);
            }
            return;
        }

        // Reduced motion = hard snap everywhere
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

        // Huge jump → snap + pick facing from actual track segment (not naive line default)
        if (dist > TELEPORT_THRESHOLD) {
            marker.setLatLng([destLat, destLng]);

            // Aim sprite using the hop we really traveled on the polyline
            if (pathData) {
                const fromP = nearestProgress(pathData, [origin.lat, origin.lng]);
                const toP = nearestProgress(pathData, [destLat, destLng]);
                const dir = trackDirection(pathData, fromP, toP);
                if (dir) state.direction = dir;
                state.currentProgress = toP;
            } else if (train.direction) {
                state.direction = train.direction;
            }

            // After teleport I'm guessing - don't coast from that
            syncIcon(false, state.direction);
            return;
        }

        // Normal case: ease along the polyline so dinos follow rails, not straight-line shortcuts
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

        // Backup if I don't have path data for some reason
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

/* MetroLine - rails + dinos for one color. Sprites force themselves into metroTrainSpritesPane. */

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
