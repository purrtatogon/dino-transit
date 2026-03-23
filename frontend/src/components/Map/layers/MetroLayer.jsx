import React from 'react';
import { Marker, Pane, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { GREEN_LINE_STATIONS } from '../data/greenLine';
import { RED_LINE_STATIONS } from '../data/redLine';
import { BLUE_LINE_STATIONS } from '../data/blueLine';
import { YELLOW_LINE_STATIONS } from '../data/yellowLine';

const LINE_COLORS = {
    blue: '#4e84c4',
    yellow: '#fdb913',
    green: '#00aaa6',
    red: '#ee2b74'
};
const LINE_CASING_COLOR = '#111111';

// Leaflet panes: lines sit under nodes, leaders, trains, then labels
const METRO_LINES_PANE_Z = 520;

const TRAIN_MARKERS_PANE_Z = 600;

const SPRITE_PX = 48;
const SPRITE_ANCHOR_X = SPRITE_PX / 2;
const SPRITE_ANCHOR_Y = SPRITE_PX;

const LINES = [
    { data: GREEN_LINE_STATIONS, color: LINE_COLORS.green },
    { data: RED_LINE_STATIONS, color: LINE_COLORS.red },
    { data: BLUE_LINE_STATIONS, color: LINE_COLORS.blue },
    { data: YELLOW_LINE_STATIONS, color: LINE_COLORS.yellow },
];

const SPRITE_FILES = {
    green: {
        east: { walk: 'brachio_greenline_east_walk.gif', idle: 'brachio_greenline_east_idle.png' },
        west: { walk: 'brachio_greenline_west_walk.gif', idle: 'brachio_greenline_west_idle.png' },
        north: { walk: 'brachio_greenline_north_walk.gif', idle: 'brachio_greenline_north_idle.png' },
        south: { walk: 'brachio_greenline_south_walk.gif', idle: 'brachio_greenline_south_idle.png' }
    },
    red: {
        east: { walk: 'brachio_redline_east_walk.gif', idle: 'brachio_redline_east_idle.png' },
        west: { walk: 'brachio_redline_west_walk.gif', idle: 'brachio_redline_west_idle.png' },
        north: { walk: 'brachio_redline_north_walk.gif', idle: 'brachio_redline_north_idle.png' },
        south: { walk: 'brachio_redline_south_walk.gif', idle: 'brachio_redline_south_idle.png' }
    },
    blue: {
        east: { walk: 'brachio_blueline_east_walk.gif', idle: 'brachio_blueline_east_idle.png' },
        west: { walk: 'brachio_blueline_west_walk.gif', idle: 'brachio_blueline_west_idle.png' },
        north: { walk: 'brachio_blueline_north_walk.gif', idle: 'brachio_blueline_north_idle.png' },
        south: { walk: 'brachio_blueline_south_walk.gif', idle: 'brachio_blueline_south_idle.png' }
    },
    yellow: {
        east: { walk: 'brachio_yellowline_east_walk.gif', idle: 'brachio_yellowline_east_idle.png' },
        west: { walk: 'brachio_yellowline_west_walk.gif', idle: 'brachio_yellowline_west_idle.png' },
        north: { walk: 'brachio_yellowline_north_walk.gif', idle: 'brachio_yellowline_north_idle.png' },
        south: { walk: 'brachio_yellowline_south_walk.gif', idle: 'brachio_yellowline_south_idle.png' }
    }
};

const getSpriteUrl = (filename) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${window.location.origin}${base}/assets/sprites/${filename}`;
};

const createDinoIcon = (status, lineColor, direction) => {
    const color = (lineColor || 'green').toLowerCase();
    const currentDirection = direction || 'east';
    const sprites = SPRITE_FILES[color][currentDirection] || SPRITE_FILES[color].east;
    const filename = status === 'Boarding' ? sprites.idle : sprites.walk;

    const spriteUrl = getSpriteUrl(filename);

    return L.divIcon({
        className: 'dino-wrapper',
        html: `<img src="${spriteUrl}" class="pixel-dino" alt="${color} dino facing ${currentDirection}" />`,
        iconSize: [SPRITE_PX, SPRITE_PX],
        iconAnchor: [SPRITE_ANCHOR_X, SPRITE_ANCHOR_Y],
        popupAnchor: [0, Math.round(-SPRITE_PX * 0.94)]
    });
};

const MetroLayer = ({ data }) => {
    const metros = data.filter(d => d.type === 'Metro');

    const casingStyle = {
        weight: 12,
        opacity: 0.95,
        lineCap: 'butt',
        lineJoin: 'miter',
        className: 'pixel-line-casing'
    };

    const colorLineStyle = {
        weight: 8,
        opacity: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        className: 'pixel-line'
    };

    return (
        <>
            <Pane name="metroLinesPane" style={{ zIndex: METRO_LINES_PANE_Z }}>
                {LINES.map((line) => (
                    <React.Fragment key={line.color}>
                        <Polyline
                            positions={line.data.map((s) => s.coords)}
                            pathOptions={{ ...casingStyle, color: LINE_CASING_COLOR }}
                        />
                        <Polyline
                            positions={line.data.map((s) => s.coords)}
                            pathOptions={{ ...colorLineStyle, color: line.color }}
                        />
                    </React.Fragment>
                ))}
            </Pane>

            <Pane name="metroTrainSpritesPane" style={{ zIndex: TRAIN_MARKERS_PANE_Z }}>
                {metros.map((train) => {
                    const icon = createDinoIcon(train.status, train.lineColor, train.direction);
                    return (
                        <Marker
                            key={train.dinoName}
                            position={[train.latitude, train.longitude]}
                            icon={icon}
                        >
                            <Popup>
                                <strong>{train.dinoName}</strong><br />
                                Status: {train.status}
                            </Popup>
                        </Marker>
                    );
                })}
            </Pane>
        </>
    );
};

export default MetroLayer;