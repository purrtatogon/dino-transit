import React, { useMemo, useState } from 'react';
import { Pane, useMap, useMapEvents } from 'react-leaflet';
import { METRO_LINES } from '../data/metroLines';
import MetroLine from './MetroLine';

const METRO_LINES_PANE_Z = 520;
const TRAIN_MARKERS_PANE_Z = 600;

const MetroMode = ({ data }) => {
    const map = useMap();
    const [zoom, setZoom] = useState(() => map.getZoom());

    useMapEvents({
        zoomend: (e) => setZoom(e.target.getZoom())
    });

    const metros = useMemo(
        () => data.filter((d) => d.type === 'Metro'),
        [data]
    );

    const trainsByLine = useMemo(() => {
        const grouped = {};
        METRO_LINES.forEach((line) => {
            grouped[line.key] = [];
        });
        metros.forEach((train) => {
            const key = (train.lineColor || 'green').toLowerCase();
            if (grouped[key]) {
                grouped[key].push(train);
            }
        });
        return grouped;
    }, [metros]);

    return (
        <>
            <Pane name="metroLinesPane" style={{ zIndex: METRO_LINES_PANE_Z }}>
                {METRO_LINES.map((line) => (
                    <MetroLine
                        key={line.key}
                        line={line}
                        trains={trainsByLine[line.key]}
                        zoom={zoom}
                    />
                ))}
            </Pane>
            <Pane name="metroTrainSpritesPane" style={{ zIndex: TRAIN_MARKERS_PANE_Z }} />
        </>
    );
};

export default MetroMode;
