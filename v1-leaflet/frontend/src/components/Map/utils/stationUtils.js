import L from 'leaflet';

import { METRO_LINES } from '../data/metroLines';

const processLine = (stations, color) =>
    stations.map((station, idx) => {
        const terminal = idx === 0 || idx === stations.length - 1;
        return {
            ...station,
            line: color,
            isTerminal: terminal,
            terminalLine: terminal ? color : undefined
        };
    });

export const RAW_STATIONS = METRO_LINES.flatMap((line) =>
    processLine(line.stations, line.key)
);

const ORDERED_LINE_STATIONS = Object.fromEntries(
    METRO_LINES.map((line) => [line.key, line.stations])
);

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
                terminalLine: station.terminalLine,
                lines: [station.line],
                labelOffset: station.labelOffset,
                labelAnchor: station.labelAnchor
            });
            return;
        }

        existing.isTerminal = existing.isTerminal || station.isTerminal;
        if (station.terminalLine && !existing.terminalLine) {
            existing.terminalLine = station.terminalLine;
        }
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

/** Plain between-stops station (exactly one line, not end of line). */
export const isIntermediateStation = (station) =>
    station.lines.length === 1 && !station.isTerminal;

const isInlineStop = isIntermediateStation;

const getNeighborsOnLine = (station, lineKey) => {
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

const computeInlineNodeAngleDeg = (map, prev, station, next) => {
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
    const isTerminal = station.isTerminal;
    const isInterchange = station.lines.length > 1;

    if (isTerminal) {
        if (zoom >= 16) return 24;
        if (zoom >= 14) return 21;
        if (zoom >= 12) return 18;
        return 15;
    }

    if (isInterchange) {
        if (zoom >= 16) return 22;
        if (zoom >= 14) return 19;
        if (zoom >= 12) return 16;
        return 13;
    }

    if (zoom >= 16) return 15;
    if (zoom >= 14) return 13;
    if (zoom >= 12) return 11;
    return 10;
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

        if (station.isTerminal) {
            const lineKey = station.terminalLine || station.lines[0];
            modifierClass = `station-node--terminal station-node--line-${lineKey}`;
        } else if (station.lines.length > 1) {
            modifierClass = 'station-node--interchange';
        } else {
            modifierClass = '';
        }
    }

    const rotateCss =
        angleDeg !== 0
            ? `transform:rotate(${angleDeg}deg);transform-origin:center center;`
            : '';

    const bbox = modifierClass.includes('inline')
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
