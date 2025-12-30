import React, { useMemo, useState } from 'react';
import L from 'leaflet';
import { Marker, Pane, useMap, useMapEvents } from 'react-leaflet';

import { GREEN_LINE, RED_LINE, BLUE_LINE, YELLOW_LINE } from '../data/metroLines';

import {
    RAW_STATIONS,
    dedupeStations,
    toStationKey,
    getNodeSize,
    isIntermediateStation
} from '../utils/stationUtils';
import { INTERCHANGE_RAIL_CONFIG, getStationLabelText } from '../utils/stationLabelModel';

// Show more names as you zoom in (Leaflet was drowning in text otherwise).
const MIN_ZOOM_FOR_INTERCHANGES = 12.5;
const MIN_ZOOM_FOR_ALL_STATIONS = 13.25;

// Font + pill sizes per zoom bucket (big stops vs small stops use different presets).
const ZOOM_TIERS_MAJOR = {
    compact:  { height: 20, fontSize: '0.72rem', railWidth: 3, charPx: 7, basePad: 10, minWidth: 54, interchangeBonus: 12 },
    medium:   { height: 24, fontSize: '0.82rem', railWidth: 3, charPx: 8, basePad: 12, minWidth: 62, interchangeBonus: 16 },
    full:     { height: 28, fontSize: '1rem',     railWidth: 4, charPx: 9, basePad: 16, minWidth: 72, interchangeBonus: 20 }
};

const ZOOM_TIERS_MINOR = {
    compact:  { height: 17, fontSize: '0.64rem', railWidth: 2, charPx: 6, basePad: 8,  minWidth: 44, interchangeBonus: 0 },
    medium:   { height: 20, fontSize: '0.72rem', railWidth: 3, charPx: 7, basePad: 10, minWidth: 50, interchangeBonus: 0 },
    full:     { height: 23, fontSize: '0.85rem', railWidth: 3, charPx: 8, basePad: 12, minWidth: 58, interchangeBonus: 0 }
};

const MAX_LABEL_WIDTH = 160;

const getZoomTierKey = (zoom) => {
    if (zoom < 12.75) return 'compact';
    if (zoom < 13.5)  return 'medium';
    return 'full';
};

// Stacking order: rails < leader < nodes < labels < dinos (hard-coded in metro map setup).
const STATION_LEADER_PANE_Z = 540;
const STATION_LABELS_PANE_Z = 570;

// How far I shove labels off the drawn line (tighter = closer to the poster look I wanted).
const LINE_STROKE_CLEARANCE_PX = 8;
const LABEL_EDGE_MARGIN_PX = 4;
const INTERCHANGE_CLEARANCE_BONUS_PX = 10;
const ORBIT_PAD_PX = 6;
const LEADER_MIN_LENGTH_PX = 4;

// Copy/paste order from metroLines.js - I walk prev/next to guess track angle.
const ORDERED_LINE_STATIONS = {
    green: GREEN_LINE.stations,
    red: RED_LINE.stations,
    blue: BLUE_LINE.stations,
    yellow: YELLOW_LINE.stations
};

// +1 / -1 picks which side of the polyline the badge sits on.
// LINE_DEFAULT_SIDE + per-station tweaks = me fighting Leaflet so it kinda matches the printed diagram.
const LINE_DEFAULT_SIDE = {
    green: 1, // mostly N-S
    red: 1,
    blue: -1,
    yellow: -1
};

const LABEL_SIDE_OVERRIDES = {
    // Hand-tuned nudges when defaults collide with another line

    'Campo Grande': -1,
    'São Sebastião': -1,    // interchange — above to clear blue line
    Saldanha: -1,           // interchange — above to clear yellow
    Chelas: -1,             // eastern loop — label left
    Olivais: -1,            // eastern loop — label left
    'Cabo Ruivo': -1,       // eastern loop — label left
    Oriente: -1,            // eastern loop — label left
    Moscavide: -1,          // line curves back, label above
    'Encarnação': -1,       // above to avoid Moscavide collision
    Aeroporto: -1,          // terminal at top of the curve
    Carnide: 1,
    'Colégio Militar/Luz': 1,
    'Alto dos Moinhos': 1,
    Laranjeiras: 1,
    'Jardim Zoológico': 1,
    'Praça de Espanha': 1,
    Parque: 1,
    Avenida: 1,
    Restauradores: 1,
    'Terreiro do Paço': 1,
    'Santa Apolónia': 1,    // terminal — right/below
    'Senhor Roubado': 1,    // right to alternate with Odivelas
    Ameixoeira: 1,          // right to alternate with Lumiar
    Lumiar: 1,              // right to match SVG layout
    'Quinta das Conchas': 1,// right to clear Campo Grande area
    'Cidade Universitária': 1,
    'Entre Campos': 1,
    'Campo Pequeno': 1,     // right to alternate with Saldanha
    Picoas: 1,              // right to alternate with Marquês
    Alameda: 1,
    'Baixa-Chiado': 1,
    'Marquês de Pombal': -1
};

// Shrink guessed box width when the name has lots of skinny letters / slashes.
const STATION_WIDTH_TRIM = {
    'Cidade Universitária': -16,
    'Terreiro do Paço':     -8,
    'Cais do Sodré':        -18,
    'Santa Apolónia':       -10,
    Roma:                   -8,
    Laranjeiras:            -10,
    Telheiras:              -10,
    'Colégio Militar/Luz':  -20,
    Anjos:                  -8,
    Alfornelos:             -10
};

// Prev/next stop on one color - need that for aiming labels.
const sameStopName = (a, b) =>
    a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

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

// Interchange = multiple lines through one dot; prefer a line where I actually have neighbors on both sides.
const getLineKeyForLabelGeometry = (station) => {
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

// Unit vector along the track in screen space (latLngToLayerPoint). Null if I can't build it.
const getTrackTangent = (map, station, lineKey) => {
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

// Small math helpers for label placement
// Cheap hash so labels split left/right if I have no better hint.
const hashNameSign = (name) => {
    let h = 0;
    for (let i = 0; i < name.length; i += 1) {
        h = (h + name.charCodeAt(i) * (i + 1)) % 2;
    }
    return h === 0 ? 1 : -1;
};

// How thick the label reads along the push-off direction (so I clear the rail stroke).
const halfExtentAlongNormal = (labelW, labelH, nx, ny) =>
    0.5 * (Math.abs(nx) * labelW + Math.abs(ny) * labelH);

// Closest point on label box - leader line lands there.
const closestPointOnRect = (px, py, rx, ry, rw, rh) => ({
    x: Math.max(rx, Math.min(px, rx + rw)),
    y: Math.max(ry, Math.min(py, ry + rh))
});

// Leader coords inside the orbit; return null if it's too stubby to bother drawing.
const computeLeader = (anchorX, anchorY, labelLeft, labelTop, labelW, labelH) => {
    const { x: ex, y: ey } = closestPointOnRect(
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

// End-of-line stops: paste label to the bubble, no whisker line.
const TERMINAL_LABEL_SIDE = {
    Telheiras:          'left',
    'Cais do Sodré':    'left',
    Reboleira:          'left',
    'Santa Apolónia':   'right',
    Odivelas:           'right',
    Rato:               'left',
    Aeroporto:          'left',
    'São Sebastião':    'left'
};

const computeTerminalLabelLayout = (map, station, labelW, labelH, zoom) => {
    const stationPt = map.latLngToLayerPoint(L.latLng(station.coords));
    const nodeHalf = Math.ceil(getNodeSize(zoom, station) / 2) + 3;
    const side = TERMINAL_LABEL_SIDE[station.name] || 'left';

    let labelX;
    if (side === 'right') {
        labelX = stationPt.x + nodeHalf;
    } else {
        labelX = stationPt.x - nodeHalf - labelW;
    }
    const labelY = stationPt.y - labelH / 2;

    const minX = Math.min(stationPt.x, labelX) - ORBIT_PAD_PX;
    const maxX = Math.max(stationPt.x, labelX + labelW) + ORBIT_PAD_PX;
    const minY = Math.min(stationPt.y, labelY) - ORBIT_PAD_PX;
    const maxY = Math.max(stationPt.y, labelY + labelH) + ORBIT_PAD_PX;

    const orbitW = Math.ceil(maxX - minX);
    const orbitH = Math.ceil(maxY - minY);
    const anchorX = Math.round(stationPt.x - minX);
    const anchorY = Math.round(stationPt.y - minY);
    const labelLeft = Math.round(labelX - minX);
    const labelTop = Math.round(labelY - minY);

    return {
        orbitW,
        orbitH,
        anchorX,
        anchorY,
        labelLeft,
        labelTop,
        showLeader: false,
        leaderX1: undefined,
        leaderY1: undefined,
        leaderX2: undefined,
        leaderY2: undefined
    };
};

// Figures out orbit box + leader line for a badge. Leaflet anchors the orbit at lat/lng; coords inside are pixel math.
const computeLabelLayout = (map, station, labelW, labelH) => {
    const stationPt = map.latLngToLayerPoint(L.latLng(station.coords));

    const lineKey = getLineKeyForLabelGeometry(station);
    const tang = getTrackTangent(map, station, lineKey);

    // +1 / -1: override table > line habit > hash tie-break
    const hashSign = hashNameSign(station.name);
    const defaultSign = LINE_DEFAULT_SIDE[lineKey] ?? hashSign;
    const sideSign = LABEL_SIDE_OVERRIDES[station.name] ?? defaultSign;

    // No tangent → fake a centered box (rare orphan stops)
    if (!tang) {
        const orbitW = labelW + 2 * ORBIT_PAD_PX;
        const orbitH = labelH + 2 * ORBIT_PAD_PX;
        const anchorX = Math.round(orbitW / 2);
        const anchorY = Math.round(orbitH / 2);
        const labelLeft = ORBIT_PAD_PX;
        const labelTop = ORBIT_PAD_PX;
        const leader = computeLeader(
            anchorX, anchorY, labelLeft, labelTop, labelW, labelH
        );
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

    // Happy path: shove label along the normal away from the track
    const { vx, vy } = tang;

    let mostlyVertical;
    if (station.labelAnchor === 'vertical') {
        mostlyVertical = true;
    } else if (station.labelAnchor === 'horizontal') {
        mostlyVertical = false;
    } else {
        mostlyVertical = Math.abs(vy) >= Math.abs(vx);
    }

    // 90 degree rotate of tangent -> outward normal
    let nx = -vy;
    let ny = vx;
    const nl = Math.hypot(nx, ny);
    nx /= nl;
    ny /= nl;

    // Standoff distance from dot to box
    const halfExt = halfExtentAlongNormal(labelW, labelH, nx, ny);
    let baseD = halfExt + LINE_STROKE_CLEARANCE_PX + LABEL_EDGE_MARGIN_PX;
    if (station.lines.length > 1) {
        baseD += INTERCHANGE_CLEARANCE_BONUS_PX;
    }

    // Apply side sign to the normal vector
    const normalX = sideSign * nx;
    const normalY = sideSign * ny;

    // Pixel top-left guess for HTML box
    let labelX;
    let labelY;
    if (mostlyVertical) {
        // Vertical-ish rail -> label slides sideways
        labelX = stationPt.x + normalX * baseD;
        labelY = stationPt.y + normalY * baseD - labelH / 2;
    } else {
        // Horizontal-ish rail -> label slides above/below
        labelX = stationPt.x + normalX * baseD - labelW / 2;
        labelY = stationPt.y + normalY * baseD - labelH;
    }

    // Optional manual dx/dy from station JSON
    const lo = station.labelOffset;
    if (lo && typeof lo.dx === 'number') {
        labelX += lo.dx;
    }
    if (lo && typeof lo.dy === 'number') {
        labelY += lo.dy;
    }

    // Tight bbox around dot + badge + pad (the "orbit")
    const minX = Math.min(stationPt.x, labelX, labelX + labelW) - ORBIT_PAD_PX;
    const maxX = Math.max(stationPt.x, labelX, labelX + labelW) + ORBIT_PAD_PX;
    const minY = Math.min(stationPt.y, labelY, labelY + labelH) - ORBIT_PAD_PX;
    const maxY = Math.max(stationPt.y, labelY, labelY + labelH) + ORBIT_PAD_PX;

    const orbitW = Math.ceil(maxX - minX);
    const orbitH = Math.ceil(maxY - minY);

    // Recenter stuff into orbit-local 0..W/H space for DivIcon HTML
    const anchorX = Math.round(stationPt.x - minX);
    const anchorY = Math.round(stationPt.y - minY);
    const labelLeft = Math.round(labelX - minX);
    const labelTop = Math.round(labelY - minY);

    // Connector line from dot to box edge
    const leader = computeLeader(
        anchorX, anchorY, labelLeft, labelTop, labelW, labelH
    );

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
};

// Rough width from string length (good enough for Leaflet divIcon)
const getAdaptiveLabelWidth = (labelText, hasGlyphPrefix, tier) => {
    const estimated = Math.ceil(labelText.length * tier.charPx + tier.basePad + (hasGlyphPrefix ? 8 : 0));
    return Math.max(tier.minWidth, Math.min(MAX_LABEL_WIDTH, estimated));
};

// Glue strings for divIcon HTML (leaders + pills)

const buildLeaderSvg = (layout) => {
    if (!layout.showLeader || layout.leaderX1 == null) {
        return '';
    }
    const { orbitW, orbitH, leaderX1, leaderY1, leaderX2, leaderY2 } = layout;
    return `<svg class="diagram-station-label__leader" width="${orbitW}" height="${orbitH}" viewBox="0 0 ${orbitW} ${orbitH}" aria-hidden="true" focusable="false"><line class="diagram-station-label__leader-casing" x1="${leaderX1}" y1="${leaderY1}" x2="${leaderX2}" y2="${leaderY2}" /><line class="diagram-station-label__leader-ink" x1="${leaderX1}" y1="${leaderY1}" x2="${leaderX2}" y2="${leaderY2}" /></svg>`;
};

// One marker pair per station: optional leader SVG + label div
const buildStationIcons = (station, map, tier, zoom) => {
    const isInterchange = station.lines.length > 1;
    const interchangeConfig = INTERCHANGE_RAIL_CONFIG[station.name];
    const lineColor = interchangeConfig ? interchangeConfig.leftLine : station.lines[0];
    const displayName = getStationLabelText(station);
    const hasGlyph = isInterchange || station.isTerminal;
    const baseWidth = getAdaptiveLabelWidth(displayName, hasGlyph, tier);
    let labelWidth;
    if (interchangeConfig) {
        labelWidth = Math.min(MAX_LABEL_WIDTH, baseWidth + (interchangeConfig.widthTrim || 0)) + tier.railWidth;
    } else {
        const trim = STATION_WIDTH_TRIM[station.name] || 0;
        if (isInterchange) {
            labelWidth = Math.min(MAX_LABEL_WIDTH, baseWidth + tier.interchangeBonus) + trim;
        } else {
            labelWidth = baseWidth + trim;
        }
    }

    const useGluedLayout = station.isTerminal && TERMINAL_LABEL_SIDE[station.name];
    const layout = useGluedLayout
        ? computeTerminalLabelLayout(map, station, labelWidth, tier.height, zoom)
        : computeLabelLayout(map, station, labelWidth, tier.height);

    const rootClass = [
        'diagram-station-label',
        `diagram-station-label--${lineColor}`,
        isInterchange ? 'diagram-interchange' : '',
        station.isTerminal ? 'diagram-terminal' : ''
    ]
        .filter(Boolean)
        .join(' ');

    const safeTitle = station.name.replace(/"/g, '&quot;');
    const safeHtml = displayName.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const leaderSvg = buildLeaderSvg(layout);
    const leaderIcon =
        leaderSvg !== ''
            ? L.divIcon({
                  className: 'station-label-wrapper',
                  html: `<div class="station-label-orbit station-label-orbit--leaderOnly" style="width:${layout.orbitW}px;height:${layout.orbitH}px;">${leaderSvg}</div>`,
                  iconSize: [layout.orbitW, layout.orbitH],
                  iconAnchor: [layout.anchorX, layout.anchorY]
              })
            : null;

    const leftRailClass = interchangeConfig
        ? `diagram-station-label__rail diagram-rail--${interchangeConfig.leftLine}`
        : 'diagram-station-label__rail';

    const rightRailHtml = interchangeConfig
        ? `<span class="diagram-station-label__rail diagram-rail--${interchangeConfig.rightLine}" style="flex:0 0 ${tier.railWidth}px;width:${tier.railWidth}px;" aria-hidden="true"></span>`
        : '';

    const labelHtml = `<div class="station-label-orbit" style="width:${layout.orbitW}px;height:${layout.orbitH}px;"><div class="${rootClass}" style="position:absolute;left:${layout.labelLeft}px;top:${layout.labelTop}px;min-width:${labelWidth}px;z-index:1;" title="${safeTitle}" aria-hidden="true"><span class="${leftRailClass}" style="flex:0 0 ${tier.railWidth}px;width:${tier.railWidth}px;" aria-hidden="true"></span><span class="diagram-station-label__text" style="font-size:${tier.fontSize};">${safeHtml}</span>${rightRailHtml}</div></div>`;

    const labelIcon = L.divIcon({
        className: 'station-label-wrapper',
        html: labelHtml,
        iconSize: [layout.orbitW, layout.orbitH],
        iconAnchor: [layout.anchorX, layout.anchorY]
    });

    return { leaderIcon, labelIcon };
};

const StationLabelsLayer = ({
    showAllStationLabels = true,
    showIntermediateStationLabels = false
}) => {
    const map = useMap();
    const [zoom, setZoom] = useState(() => map.getZoom());
    // Panning shifts layer-point math too, not only zoom — tick forces label re-layout.
    const [panTick, setPanTick] = useState(0);

    useMapEvents({
        zoomend: (event) => {
            setZoom(event.target.getZoom());
        },
        moveend: () => {
            setPanTick((t) => t + 1);
        }
    });

    const stations = useMemo(() => dedupeStations(RAW_STATIONS), []);
    const showInterchanges = zoom >= MIN_ZOOM_FOR_INTERCHANGES;
    const showAllStations = zoom >= MIN_ZOOM_FOR_ALL_STATIONS;

    const visibleStations = useMemo(
        () =>
            stations.filter((station) => {
                if (showAllStations) return true;
                if (station.isTerminal) return true;
                if (showInterchanges && station.lines.length > 1) return true;
                return false;
            }),
        [showAllStations, showInterchanges, stations]
    );

    const stationsForLabels = useMemo(() => {
        if (!showAllStationLabels) {
            return [];
        }
        if (!showIntermediateStationLabels) {
            return visibleStations.filter((station) => !isIntermediateStation(station));
        }
        return visibleStations;
    }, [visibleStations, showAllStationLabels, showIntermediateStationLabels]);

    const tierKey = getZoomTierKey(zoom);

    const stationIconRows = useMemo(
        () =>
            stationsForLabels.map((station) => {
                const isImportant = station.isTerminal || station.lines.length > 1;
                const tier = isImportant
                    ? ZOOM_TIERS_MAJOR[tierKey]
                    : ZOOM_TIERS_MINOR[tierKey];
                return {
                    key: toStationKey(station),
                    station,
                    ...buildStationIcons(station, map, tier, zoom)
                };
            }),
        [stationsForLabels, map, zoom, panTick, tierKey]
    );

    return (
        <>
            <Pane name="stationLeaderPane" style={{ zIndex: STATION_LEADER_PANE_Z }}>
                {stationIconRows
                    .filter((row) => row.leaderIcon)
                    .map(({ key, station, leaderIcon }) => (
                        <Marker
                            key={`station-leader-${key}`}
                            position={station.coords}
                            icon={leaderIcon}
                            interactive={false}
                        />
                    ))}
            </Pane>
            <Pane name="stationLabelsPane" style={{ zIndex: STATION_LABELS_PANE_Z }}>
                {stationIconRows.map(({ key, station, labelIcon }) => (
                    <Marker
                        key={`station-label-${key}`}
                        position={station.coords}
                        icon={labelIcon}
                        zIndexOffset={1000}
                        interactive={false}
                    />
                ))}
            </Pane>
        </>
    );
};

export default StationLabelsLayer;
