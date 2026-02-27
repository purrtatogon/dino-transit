import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

import { GREEN_LINE_STATIONS } from '../data/greenLine';
import { RED_LINE_STATIONS } from '../data/redLine';
import { BLUE_LINE_STATIONS } from '../data/blueLine';
import { YELLOW_LINE_STATIONS } from '../data/yellowLine';

// Helper function to tag lines and identify terminal stations
const processLine = (stations, color) => {
    return stations.map((station, idx) => ({
        ...station,
        line: color,
        // It's a terminal if it's the first or last station in the array
        isTerminal: idx === 0 || idx === stations.length - 1 
    }));
};

const ALL_STATIONS = [
    ...processLine(GREEN_LINE_STATIONS, 'green'),
    ...processLine(RED_LINE_STATIONS, 'red'),
    ...processLine(BLUE_LINE_STATIONS, 'blue'),
    ...processLine(YELLOW_LINE_STATIONS, 'yellow')
];

const createStationIcon = (name, lineColor, isTerminal) => {
    // If it's a terminal, add a special class and a star symbol for WCAG non-color compliance
    const terminalClass = isTerminal ? 'terminal-sign' : '';
    const displayName = isTerminal ? `★ ${name} ★` : name;

    return L.divIcon({
        className: 'station-label-wrapper',
        html: `<div class="pixel-station-sign ${lineColor}-line-sign ${terminalClass}">${displayName}</div>`,
        iconSize: [80, 16],
        iconAnchor: [40, 20]
    });
};

const StationLayer = () => {
    return (
        <>
            {ALL_STATIONS.map((station, idx) => (
                <Marker 
                    key={`station-${station.name}-${idx}`} 
                    position={station.coords} 
                    icon={createStationIcon(station.name, station.line, station.isTerminal)}
                />
            ))}
        </>
    );
};

export default StationLayer;