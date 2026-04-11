import React, { useCallback, useLayoutEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MetroMode from './layers/MetroMode';
import StationNodesLayer from './layers/StationNodesLayer';
import StationLabelsLayer from './layers/StationLabelsLayer';
import s from '@styles/LiveDinoMap.module.css';
import g from '@styles/global.module.css';

const SHOW_STATION_LABELS = true;
const SHOW_STATION_NODES = true;

const getDinoScale = (zoom) => {
    if (zoom <= 11) return 0.5;
    if (zoom >= 16) return 1.3;
    return +(0.5 + (zoom - 11) * 0.16).toFixed(3);
};

const ZoomCssSync = () => {
    const map = useMap();

    const sync = useCallback(() => {
        const scale = getDinoScale(map.getZoom());
        map.getContainer().style.setProperty('--dino-scale', scale);
    }, [map]);

    useMapEvents({ zoomend: sync });
    useLayoutEffect(() => { sync(); }, [sync]);

    return null;
};

// A hand-tuned bounding box that frames the densest part of the metro
// network.  Using the raw station extremes (Reboleira west, Cais do
// Sodré south) made the initial view too wide — those outliers push the
// zoom out.  This tighter box lets the user see the core network at a
// comfortable zoom; the outlier stations are just a small pan away.
const NETWORK_BOUNDS = L.latLngBounds(
    [38.705, -9.200],   // south-west corner (just below Restauradores)
    [38.795, -9.095]    // north-east corner (just above Odivelas / past Oriente)
);
const FIT_OPTIONS = {
    paddingTopLeft: [260, 10],
    paddingBottomRight: [10, 10],
    maxZoom: 13.5
};

const MapInvalidateWhenShown = ({ isShown }) => {
    const map = useMap();
    useLayoutEffect(() => {
        if (!isShown) return undefined;
        const id = requestAnimationFrame(() => {
            map.invalidateSize();
        });
        const t = window.setTimeout(() => {
            map.invalidateSize();
        }, 280);
        return () => {
            cancelAnimationFrame(id);
            window.clearTimeout(t);
        };
    }, [isShown, map]);
    return null;
};

// Fit the map to the metro network bounding box on first mount so the
// user immediately sees all lines, sprites, and labels without having
// to zoom out manually.  Runs only once.
const FitToNetwork = () => {
    const map = useMap();
    const fitted = useRef(false);
    useLayoutEffect(() => {
        if (fitted.current) return;
        fitted.current = true;
        map.fitBounds(NETWORK_BOUNDS, FIT_OPTIONS);
    }, [map]);
    return null;
};

const LiveDinoMap = ({
    layers,
    transportData,
    isPlannerOpen,
    onStationSelect,
    onPlannerToggle,
    showAllStationLabels,
    showIntermediateStationLabels
}) => (
    <div className={s.mapColumn}>
        <div className={s.topControls}>
            <button
                type="button"
                className={`${s.panelToggle} ${g.focusVisible}`}
                onClick={onPlannerToggle}
                aria-expanded={isPlannerOpen}
                aria-controls="metro-planner-panel"
            >
                {isPlannerOpen ? 'Hide trip planner' : 'Show trip planner'}
            </button>
        </div>

        <div className={s.mapSlot}>
            <div id="dino-live-map-region" className={s.mapViewport}>
                <MapContainer
                    center={NETWORK_BOUNDS.getCenter()}
                    zoom={12}
                    zoomSnap={0.25}
                    zoomDelta={0.5}
                    className={s.mapContainer}
                    aria-label="Lisbon metro map with live dinosaur metro icons"
                >
                    <FitToNetwork />
                    <ZoomCssSync />
                    <MapInvalidateWhenShown isShown />
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        className="pixel-map-tiles"
                    />
                    {SHOW_STATION_NODES && (
                        <StationNodesLayer onStationSelect={onStationSelect} />
                    )}
                    {SHOW_STATION_LABELS && (
                        <StationLabelsLayer
                            showAllStationLabels={showAllStationLabels}
                            showIntermediateStationLabels={showIntermediateStationLabels}
                        />
                    )}
                    {layers.metro && <MetroMode data={transportData} />}
                </MapContainer>
            </div>
        </div>
    </div>
);

export default LiveDinoMap;
