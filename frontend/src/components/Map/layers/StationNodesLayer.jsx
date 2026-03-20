import React, { useMemo, useState } from 'react';
import { Marker, Pane, useMap, useMapEvents } from 'react-leaflet';

import {
    RAW_STATIONS,
    createStationNodeIcon,
    dedupeStations,
    toStationKey
} from './stationLayerShared';

// Under the train sprites (600) so dinos paint on top
const STATION_NODES_PANE_Z = 555;

const StationNodesLayer = ({ onStationSelect }) => {
    const map = useMap();
    const [zoom, setZoom] = useState(() => map.getZoom());
    const [, setViewTick] = useState(0);

    useMapEvents({
        zoomend: (e) => {
            setZoom(e.target.getZoom());
        },
        moveend: () => {
            setViewTick((n) => n + 1);
        }
    });

    const stations = useMemo(() => dedupeStations(RAW_STATIONS), []);

    return (
        <Pane name="stationNodesOnlyPane" style={{ zIndex: STATION_NODES_PANE_Z }}>
            {stations.map((station) => (
                <Marker
                    key={`station-node-${toStationKey(station)}`}
                    position={station.coords}
                    icon={createStationNodeIcon(station, zoom, map)}
                    interactive
                    keyboard
                    title={`Station marker for ${station.name}`}
                    eventHandlers={{
                        click: () => {
                            onStationSelect?.(station.name);
                        }
                    }}
                />
            ))}
        </Pane>
    );
};

export default StationNodesLayer;
