import L from 'leaflet';

import { GREEN_LINE_STATIONS } from '../data/greenLine';
import { RED_LINE_STATIONS } from '../data/redLine';
import { BLUE_LINE_STATIONS } from '../data/blueLine';
import { YELLOW_LINE_STATIONS } from '../data/yellowLine';

const processLine = (stations, color) =>
    stations.map((station, idx) => ({
        ...station,
        line: color,
        isTerminal: idx === 0 || idx === stations.length - 1
    }));

export const RAW_STATIONS = [
    ...processLine(GREEN_LINE_STATIONS, 'green'),
    ...processLine(RED_LINE_STATIONS, 'red'),
    ...processLine(BLUE_LINE_STATIONS, 'blue'),
    ...processLine(YELLOW_LINE_STATIONS, 'yellow')
];

export const ORDERED_LINE_STATIONS = {
    green: GREEN_LINE_STATIONS,
    red: RED_LINE_STATIONS,
    blue: BLUE_LINE_STATIONS,
    yellow: YELLOW_LINE_STATIONS
};

export const toStationKey = (station) => {
    const [lat, lng] = station.coords;
    return `${station.name.toLowerCase()}::${lat.toFixed(4)}::${lng.toFixed(4)}`;
};

const sameStopName = (a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

export const dedupeStations = (stations) => {
    const byStationKey = new Map();

    stations.forEach((station) => {
        const key = toStationKey(station);
        const existing = byStationKey.get(key);

        if (!existing) {
            byStationKey.set(key, {
                name: station.name,
                coords: station.coords,
                isTerminal: station.isTerminal,
                lines: [station.line],
                labelOffset: station.labelOffset,
                labelAnchor: station.labelAnchor
            });
            return;
        }

        existing.isTerminal = existing.isTerminal || station.isTerminal;
        if (!existing.lines.includes(station.line)) {
            existing.lines.push(station.line);
        }
        if (station.labelOffset && !existing.labelOffset) {
            existing.labelOffset = station.labelOffset;
        }
        if (station.labelAnchor && !existing.labelAnchor) {
            existing.labelAnchor = station.labelAnchor;
        }
    });

    return Array.from(byStationKey.values());
};

export const isInlineStop = (station) => station.lines.length === 1 && !station.isTerminal;

export const getNeighborsOnLine = (station, lineKey) => {
    const arr = ORDERED_LINE_STATIONS[lineKey];
    if (!arr) {
        return null;
    }
    const idx = arr.findIndex((s) => sameStopName(s, station));
    if (idx < 0) {
        return null;
    }
    return {
        prev: idx > 0 ? arr[idx - 1] : null,
        next: idx < arr.length - 1 ? arr[idx + 1] : null
    };
};

// At interchanges, pick a line that has both neighbours so the angle isn’t weird
export const getLineKeyForLabelGeometry = (station) => {
    if (station.lines.length === 1) {
        return station.lines[0];
    }
    for (let i = 0; i < station.lines.length; i += 1) {
        const lineKey = station.lines[i];
        const n = getNeighborsOnLine(station, lineKey);
        if (n?.prev && n?.next) {
            return lineKey;
        }
    }
    return station.lines[0];
};

const LINE_STROKE_CLEARANCE_PX = 16;
const LABEL_EDGE_MARGIN_PX = 10;
const INTERCHANGE_CLEARANCE_BONUS_PX = 20;
const SPRITE_NEAR_STATION_THRESHOLD_PX = 58;

const SPRITE_EXTRA_CLEARANCE_PX = 28;

const MIN_SPRITE_TO_LABEL_RECT_PX = 30;

const SPRITE_GAP_EXPAND_STEP_PX = 8;

const MAX_SPRITE_GAP_EXPAND_PX = 80;

const ORBIT_PAD_PX = 10;

const LEADER_MIN_LENGTH_PX = 8;

// Manual left/right nudge if a label still sits on top of the track
export const LABEL_SIDE_OVERRIDES = {
    Alameda: 1,
    Saldanha: -1,
    'São Sebastião': -1,
    'Marquês de Pombal': -1,
    'Baixa-Chiado': 1,
    'Campo Grande': -1
};

export const getTrackUnitVectorLayerPx = (map, station, lineKey) => {
    if (!map) {
        return null;
    }
    const n = getNeighborsOnLine(station, lineKey);
    if (!n) {
        return null;
    }
    const pS = map.latLngToLayerPoint(L.latLng(station.coords));
    let dx;
    let dy;
    if (n.prev && n.next) {
        const pP = map.latLngToLayerPoint(L.latLng(n.prev.coords));
        const pN = map.latLngToLayerPoint(L.latLng(n.next.coords));
        dx = pN.x - pP.x;
        dy = pN.y - pP.y;
    } else if (n.next) {
        const pN = map.latLngToLayerPoint(L.latLng(n.next.coords));
        dx = pN.x - pS.x;
        dy = pN.y - pS.y;
    } else if (n.prev) {
        const pP = map.latLngToLayerPoint(L.latLng(n.prev.coords));
        dx = pS.x - pP.x;
        dy = pS.y - pP.y;
    } else {
        return null;
    }
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
        return null;
    }
    return { vx: dx / len, vy: dy / len };
};

const halfExtentAlongNormal = (labelWidthPx, labelHeightPx, nx, ny) =>
    0.5 * (Math.abs(nx) * labelWidthPx + Math.abs(ny) * labelHeightPx);

const layerDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const minDistPointToRect = (px, py, rx, ry, rw, rh) => {
    const cx = Math.min(Math.max(px, rx), rx + rw);
    const cy = Math.min(Math.max(py, ry), ry + rh);
    return Math.hypot(px - cx, py - cy);
};

const minDistMetrosToRect = (metroLayerPoints, rx, ry, rw, rh) => {
    if (!metroLayerPoints.length) {
        return Number.POSITIVE_INFINITY;
    }
    let minD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < metroLayerPoints.length; i += 1) {
        const p = metroLayerPoints[i];
        const d = minDistPointToRect(p.x, p.y, rx, ry, rw, rh);
        if (d < minD) {
            minD = d;
        }
    }
    return minD;
};

const hashNameSign = (name) => {
    let h = 0;
    for (let i = 0; i < name.length; i += 1) {
        h = (h + name.charCodeAt(i) * (i + 1)) % 2;
    }
    return h === 0 ? 1 : -1;
};

const stripDiagramInternal = (layout) => {
    const { L0x, L0y, sideSign, ...rest } = layout;
    return rest;
};

const closestPointOnRectToPoint = (px, py, rx, ry, rw, rh) => ({
    x: Math.max(rx, Math.min(px, rx + rw)),
    y: Math.max(ry, Math.min(py, ry + rh))
});

const computeLeaderInOrbit = (anchorX, anchorY, labelLeft, labelTop, labelW, labelH) => {
    const { x: ex, y: ey } = closestPointOnRectToPoint(
        anchorX,
        anchorY,
        labelLeft,
        labelTop,
        labelW,
        labelH
    );
    const len = Math.hypot(ex - anchorX, ey - anchorY);
    if (len < LEADER_MIN_LENGTH_PX) {
        return null;
    }
    return { x1: anchorX, y1: anchorY, x2: ex, y2: ey };
};

const expandLayoutForSpriteGap = (
    layout,
    sign,
    mostlyVertical,
    initialBaseD,
    build,
    labelW,
    labelH,
    metroLayerPoints
) => {
    let L = layout;
    let extra = 0;
    while (metroLayerPoints.length > 0 && extra < MAX_SPRITE_GAP_EXPAND_PX) {
        const md = minDistMetrosToRect(metroLayerPoints, L.L0x, L.L0y, labelW, labelH);
        if (md >= MIN_SPRITE_TO_LABEL_RECT_PX) {
            return L;
        }
        extra += SPRITE_GAP_EXPAND_STEP_PX;
        L = build(sign, mostlyVertical, initialBaseD + extra);
    }
    return L;
};

// Diagram-style label: pick a side of the track from the angle; optional labelOffset / labelAnchor on the stop tweak it
export const computeDiagramLabelLayout = (map, station, options) => {
    const { labelW, labelH, metroLayerPoints = [] } = options;
    const stationPt = map.latLngToLayerPoint(L.latLng(station.coords));

    const lineKey = getLineKeyForLabelGeometry(station);
    const tang = getTrackUnitVectorLayerPx(map, station, lineKey);

    const hashSign = hashNameSign(station.name);
    const forcedSide = LABEL_SIDE_OVERRIDES[station.name];

    const buildForSign = (sign, mostlyVertical, baseD) => {
        let nx = -tang.vy;
        let ny = tang.vx;
        const nl = Math.hypot(nx, ny);
        nx /= nl;
        ny /= nl;
        const N = { x: sign * nx, y: sign * ny };
        const d = baseD;

        let L0x;
        let L0y;
        if (mostlyVertical) {
            const LmidLeft = { x: stationPt.x + N.x * d, y: stationPt.y + N.y * d };
            L0x = LmidLeft.x;
            L0y = LmidLeft.y - labelH / 2;
        } else {
            const B = { x: stationPt.x + N.x * d, y: stationPt.y + N.y * d };
            L0x = B.x - labelW / 2;
            L0y = B.y - labelH;
        }

        const lo = station.labelOffset;
        if (lo && typeof lo.dx === 'number') {
            L0x += lo.dx;
        }
        if (lo && typeof lo.dy === 'number') {
            L0y += lo.dy;
        }

        const minX = Math.min(stationPt.x, L0x, L0x + labelW) - ORBIT_PAD_PX;
        const maxX = Math.max(stationPt.x, L0x, L0x + labelW) + ORBIT_PAD_PX;
        const minY = Math.min(stationPt.y, L0y, L0y + labelH) - ORBIT_PAD_PX;
        const maxY = Math.max(stationPt.y, L0y, L0y + labelH) + ORBIT_PAD_PX;

        const orbitW = Math.ceil(maxX - minX);
        const orbitH = Math.ceil(maxY - minY);
        const anchorX = Math.round(stationPt.x - minX);
        const anchorY = Math.round(stationPt.y - minY);
        const labelLeft = Math.round(L0x - minX);
        const labelTop = Math.round(L0y - minY);

        const leader = computeLeaderInOrbit(anchorX, anchorY, labelLeft, labelTop, labelW, labelH);

        return {
            orbitW,
            orbitH,
            anchorX,
            anchorY,
            labelLeft,
            labelTop,
            L0x,
            L0y,
            sideSign: sign,
            showLeader: leader != null,
            leaderX1: leader?.x1,
            leaderY1: leader?.y1,
            leaderX2: leader?.x2,
            leaderY2: leader?.y2
        };
    };

    const scoreLayout = (layout) => {
        const m = minDistMetrosToRect(
            metroLayerPoints,
            layout.L0x,
            layout.L0y,
            labelW,
            labelH
        );
        const midY = layout.L0y + labelH / 2;
        const aboveBias = midY < stationPt.y ? 24 : 0;
        return m + aboveBias;
    };

    if (!tang) {
        const pad = ORBIT_PAD_PX;
        const orbitW = labelW + 2 * pad;
        const orbitH = labelH + 2 * pad;
        const anchorX = Math.round(orbitW / 2);
        const anchorY = Math.round(orbitH / 2);
        const labelLeft = pad;
        const labelTop = pad;
        const leader = computeLeaderInOrbit(anchorX, anchorY, labelLeft, labelTop, labelW, labelH);
        return {
            orbitW,
            orbitH,
            anchorX,
            anchorY,
            labelLeft,
            labelTop,
            showLeader: leader != null,
            leaderX1: leader?.x1,
            leaderY1: leader?.y1,
            leaderX2: leader?.x2,
            leaderY2: leader?.y2
        };
    }

    const { vx, vy } = tang;
    let mostlyVertical;
    if (station.labelAnchor === 'vertical') {
        mostlyVertical = true;
    } else if (station.labelAnchor === 'horizontal') {
        mostlyVertical = false;
    } else {
        mostlyVertical = Math.abs(vy) >= Math.abs(vx);
    }

    let nx0 = -vy;
    let ny0 = vx;
    const nl0 = Math.hypot(nx0, ny0);
    nx0 /= nl0;
    ny0 /= nl0;

    const halfExtent = halfExtentAlongNormal(labelW, labelH, nx0, ny0);
    let baseD = halfExtent + LINE_STROKE_CLEARANCE_PX + LABEL_EDGE_MARGIN_PX;
    if (station.lines.length > 1) {
        baseD += INTERCHANGE_CLEARANCE_BONUS_PX;
    }

    let spriteBoost = false;
    for (let i = 0; i < metroLayerPoints.length; i += 1) {
        if (layerDist(metroLayerPoints[i], stationPt) < SPRITE_NEAR_STATION_THRESHOLD_PX) {
            spriteBoost = true;
            break;
        }
    }
    if (spriteBoost) {
        baseD += SPRITE_EXTRA_CLEARANCE_PX;
    }

    if (forcedSide === 1 || forcedSide === -1) {
        let L = buildForSign(forcedSide, mostlyVertical, baseD);
        L = expandLayoutForSpriteGap(
            L,
            forcedSide,
            mostlyVertical,
            baseD,
            buildForSign,
            labelW,
            labelH,
            metroLayerPoints
        );
        return stripDiagramInternal(L);
    }

    const a = buildForSign(1, mostlyVertical, baseD);
    const b = buildForSign(-1, mostlyVertical, baseD);

    if (!mostlyVertical) {
        const sa = scoreLayout(a);
        const sb = scoreLayout(b);
        let pick = Math.abs(sa - sb) < 3 ? (hashSign === 1 ? a : b) : sa >= sb ? a : b;
        pick = expandLayoutForSpriteGap(
            pick,
            pick.sideSign,
            mostlyVertical,
            baseD,
            buildForSign,
            labelW,
            labelH,
            metroLayerPoints
        );
        return stripDiagramInternal(pick);
    }

    if (!metroLayerPoints.length) {
        let pick = hashSign === 1 ? a : b;
        pick = expandLayoutForSpriteGap(
            pick,
            pick.sideSign,
            mostlyVertical,
            baseD,
            buildForSign,
            labelW,
            labelH,
            metroLayerPoints
        );
        return stripDiagramInternal(pick);
    }

    const ma = minDistMetrosToRect(metroLayerPoints, a.L0x, a.L0y, labelW, labelH);
    const mb = minDistMetrosToRect(metroLayerPoints, b.L0x, b.L0y, labelW, labelH);
    let pick = Math.abs(ma - mb) < 4 ? (hashSign === 1 ? a : b) : ma >= mb ? a : b;
    pick = expandLayoutForSpriteGap(
        pick,
        pick.sideSign,
        mostlyVertical,
        baseD,
        buildForSign,
        labelW,
        labelH,
        metroLayerPoints
    );
    return stripDiagramInternal(pick);
};

// Rotate the little mid-line square so it lines up with the track
export const computeInlineNodeAngleDeg = (map, prev, station, next) => {
    if (!map || !prev || !next) {
        return 0;
    }
    const pA = map.latLngToLayerPoint(L.latLng(prev.coords));
    const pB = map.latLngToLayerPoint(L.latLng(station.coords));
    const pC = map.latLngToLayerPoint(L.latLng(next.coords));

    const ang1 = Math.atan2(pB.y - pA.y, pB.x - pA.x);
    const ang2 = Math.atan2(pC.y - pB.y, pC.x - pB.x);
    const sumX = Math.cos(ang1) + Math.cos(ang2);
    const sumY = Math.sin(ang1) + Math.sin(ang2);
    if (sumX === 0 && sumY === 0) {
        return 0;
    }
    return (Math.atan2(sumY, sumX) * 180) / Math.PI;
};

const LINE_INNER_PX = 8;

export const getNodeSize = (zoom, station) => {
    let base = 10;
    if (zoom >= 16) {
        base = 15;
    } else if (zoom >= 14) {
        base = 13;
    } else if (zoom >= 12) {
        base = 11;
    }

    if (station.lines.length > 1 || station.isTerminal) {
        base += 2;
    }

    return base;
};

const getInlineNodeInnerSize = (zoom) => {
    const cap = Math.max(4, LINE_INNER_PX - 2);
    let s = 5;
    if (zoom >= 16) {
        s = 7;
    } else if (zoom >= 14) {
        s = 6;
    } else if (zoom >= 12) {
        s = 6;
    }
    return Math.min(s, cap);
};

export const createStationNodeIcon = (station, zoom, map) => {
    let innerSize;
    let angleDeg = 0;
    let modifierClass = '';

    let asHub = !isInlineStop(station);

    if (!asHub && map) {
        const lineKey = station.lines[0];
        const neighbors = getNeighborsOnLine(station, lineKey);
        if (neighbors?.prev && neighbors?.next) {
            innerSize = getInlineNodeInnerSize(zoom);
            angleDeg = computeInlineNodeAngleDeg(map, neighbors.prev, station, neighbors.next);
            modifierClass = 'station-node--inline';
        } else {
            asHub = true;
        }
    }

    if (asHub) {
        innerSize = getNodeSize(zoom, station);
        angleDeg = 0;
        modifierClass = '';
    }

    const rotateCss =
        angleDeg !== 0
            ? `transform:rotate(${angleDeg}deg);transform-origin:center center;`
            : '';

    const bbox = modifierClass
        ? Math.ceil(innerSize * Math.SQRT2 + 6)
        : Math.max(innerSize + 4, Math.ceil(innerSize * Math.SQRT2 + 2));

    const cls = modifierClass ? `station-node ${modifierClass}` : 'station-node';

    return L.divIcon({
        className: 'station-node-wrapper',
        html: `<span class="${cls}" style="width:${innerSize}px;height:${innerSize}px;${rotateCss}" role="presentation" aria-hidden="true"></span>`,
        iconSize: [bbox, bbox],
        iconAnchor: [Math.floor(bbox / 2), Math.floor(bbox / 2)]
    });
};
