import React, { useMemo, useState } from 'react';
import L from 'leaflet';
import { Marker, Pane, useMap, useMapEvents } from 'react-leaflet';

import {
    RAW_STATIONS,
    computeDiagramLabelLayout,
    dedupeStations,
    toStationKey
} from './stationLayerShared';

const GLYPH_THIN = '\u2009';

// Below this zoom we thin out labels so the map isn’t spammed
const MIN_ZOOM_FOR_ALL_STATIONS = 13;
const MIN_LABEL_WIDTH = 72;
const MAX_LABEL_WIDTH = 280;
const INTERCHANGE_WIDTH_BONUS = 20;
const LABEL_HEIGHT = 28;

// Leaders above the track but under moving sprites (see MetroLayer pane numbers)
const STATION_LEADER_PANE_Z = 575;

const STATION_LABELS_PANE_Z = 690;

const getStationLabel = (station) => {
    const base = station.name;
    if (station.lines.length > 1) {
        return `◆${GLYPH_THIN}${base}`;
    }
    if (station.isTerminal) {
        return `★${GLYPH_THIN}${base}`;
    }
    return base;
};

const getAdaptiveLabelWidth = (labelText, hasGlyphPrefix) => {
    const estimated = Math.ceil(labelText.length * 9 + 16 + (hasGlyphPrefix ? 8 : 0));
    return Math.max(MIN_LABEL_WIDTH, Math.min(MAX_LABEL_WIDTH, estimated));
};

const buildLeaderSvg = (layout) => {
    if (!layout.showLeader || layout.leaderX1 == null) {
        return '';
    }
    const { orbitW, orbitH, leaderX1, leaderY1, leaderX2, leaderY2 } = layout;
    return `<svg class="diagram-station-label__leader" width="${orbitW}" height="${orbitH}" viewBox="0 0 ${orbitW} ${orbitH}" aria-hidden="true" focusable="false"><line class="diagram-station-label__leader-casing" x1="${leaderX1}" y1="${leaderY1}" x2="${leaderX2}" y2="${leaderY2}" /><line class="diagram-station-label__leader-ink" x1="${leaderX1}" y1="${leaderY1}" x2="${leaderX2}" y2="${leaderY2}" /></svg>`;
};

const buildStationIcons = (station, map, metroLayerPoints) => {
    const isInterchange = station.lines.length > 1;
    const lineColor = station.lines[0];
    const displayName = getStationLabel(station);
    const hasGlyph = isInterchange || station.isTerminal;
    const baseWidth = getAdaptiveLabelWidth(displayName, hasGlyph);
    const labelWidth = isInterchange
        ? Math.min(MAX_LABEL_WIDTH, baseWidth + INTERCHANGE_WIDTH_BONUS)
        : baseWidth;

    const layout = computeDiagramLabelLayout(map, station, {
        labelW: labelWidth,
        labelH: LABEL_HEIGHT,
        metroLayerPoints
    });

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

    const labelHtml = `<div class="station-label-orbit" style="width:${layout.orbitW}px;height:${layout.orbitH}px;"><div class="${rootClass}" style="position:absolute;left:${layout.labelLeft}px;top:${layout.labelTop}px;min-width:${labelWidth}px;z-index:1;" title="${safeTitle}" aria-hidden="true"><span class="diagram-station-label__rail" aria-hidden="true"></span><span class="diagram-station-label__text">${safeHtml}</span></div></div>`;

    const labelIcon = L.divIcon({
        className: 'station-label-wrapper',
        html: labelHtml,
        iconSize: [layout.orbitW, layout.orbitH],
        iconAnchor: [layout.anchorX, layout.anchorY]
    });

    return { leaderIcon, labelIcon };
};

const StationLabelsLayer = ({ metroVehicles = [] }) => {
    const map = useMap();
    const [zoom, setZoom] = useState(() => map.getZoom());
    const [viewTick, setViewTick] = useState(0);

    useMapEvents({
        zoomend: (event) => {
            setZoom(event.target.getZoom());
        },
        moveend: () => {
            setViewTick((n) => n + 1);
        }
    });

    const metroLayerPoints = useMemo(() => {
        if (!map || !metroVehicles.length) {
            return [];
        }
        return metroVehicles.map((m) =>
            map.latLngToLayerPoint(L.latLng([m.latitude, m.longitude]))
        );
    }, [map, metroVehicles, zoom, viewTick]);

    const stations = useMemo(() => dedupeStations(RAW_STATIONS), []);
    const showAllStations = zoom >= MIN_ZOOM_FOR_ALL_STATIONS;

    const visibleStations = useMemo(
        () =>
            stations.filter((station) => {
                if (showAllStations) {
                    return true;
                }
                return station.isTerminal || station.lines.length > 1;
            }),
        [showAllStations, stations]
    );

    const stationIconRows = useMemo(
        () =>
            visibleStations.map((station) => ({
                key: toStationKey(station),
                station,
                ...buildStationIcons(station, map, metroLayerPoints)
            })),
        [visibleStations, map, metroLayerPoints, zoom, viewTick]
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
