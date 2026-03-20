import { GREEN_LINE_STATIONS } from '../data/greenLine';
import { RED_LINE_STATIONS } from '../data/redLine';
import { BLUE_LINE_STATIONS } from '../data/blueLine';
import { YELLOW_LINE_STATIONS } from '../data/yellowLine';

export const METRO_LINES = {
    green: GREEN_LINE_STATIONS,
    red: RED_LINE_STATIONS,
    blue: BLUE_LINE_STATIONS,
    yellow: YELLOW_LINE_STATIONS
};

const normalizeName = (name) => name.trim().toLowerCase();

const buildGraph = () => {
    const graph = new Map();
    const stationDisplayNames = new Map();

    const addNode = (name) => {
        const normalized = normalizeName(name);
        if (!graph.has(normalized)) {
            graph.set(normalized, []);
            stationDisplayNames.set(normalized, name);
        }
        return normalized;
    };

    Object.entries(METRO_LINES).forEach(([line, stations]) => {
        stations.forEach((station, index) => {
            const current = addNode(station.name);
            if (index === 0) {
                return;
            }

            const previous = addNode(stations[index - 1].name);
            graph.get(current).push({ to: previous, line });
            graph.get(previous).push({ to: current, line });
        });
    });

    return { graph, stationDisplayNames };
};

const { graph: METRO_GRAPH, stationDisplayNames: STATION_DISPLAY_NAMES } = buildGraph();

export const ALL_STATIONS = Array.from(STATION_DISPLAY_NAMES.values()).sort((a, b) =>
    a.localeCompare(b)
);

export const findMetroRoute = (fromStation, toStation) => {
    if (!fromStation || !toStation) {
        return null;
    }

    const from = normalizeName(fromStation);
    const to = normalizeName(toStation);

    if (!METRO_GRAPH.has(from) || !METRO_GRAPH.has(to)) {
        return null;
    }

    if (from === to) {
        const stationName = STATION_DISPLAY_NAMES.get(from);
        return {
            stations: [stationName],
            steps: [`You are already at ${stationName}.`],
            transferStations: []
        };
    }

    const queue = [from];
    const visited = new Set([from]);
    const previousByStation = new Map();

    while (queue.length > 0) {
        const station = queue.shift();
        const neighbors = METRO_GRAPH.get(station) || [];

        for (const edge of neighbors) {
            if (visited.has(edge.to)) {
                continue;
            }

            visited.add(edge.to);
            previousByStation.set(edge.to, { station, line: edge.line });

            if (edge.to === to) {
                queue.length = 0;
                break;
            }

            queue.push(edge.to);
        }
    }

    if (!previousByStation.has(to)) {
        return null;
    }

    const stationPath = [];
    const linePath = [];
    let current = to;

    while (current !== from) {
        const entry = previousByStation.get(current);
        stationPath.push(current);
        linePath.push(entry.line);
        current = entry.station;
    }
    stationPath.push(from);
    stationPath.reverse();
    linePath.reverse();

    const steps = [];
    const transferStations = [];
    let segmentStart = 0;

    for (let i = 1; i <= linePath.length; i += 1) {
        const lineChanged = i === linePath.length || linePath[i] !== linePath[i - 1];
        if (!lineChanged) {
            continue;
        }

        const line = linePath[i - 1];
        const fromIdx = segmentStart;
        const toIdx = i;
        const startStation = STATION_DISPLAY_NAMES.get(stationPath[fromIdx]);
        const endStation = STATION_DISPLAY_NAMES.get(stationPath[toIdx]);
        const stopCount = toIdx - fromIdx;
        steps.push(
            `Take ${line} line from ${startStation} to ${endStation} (${stopCount} ${
                stopCount === 1 ? 'stop' : 'stops'
            }).`
        );

        if (i < linePath.length) {
            const transferAt = STATION_DISPLAY_NAMES.get(stationPath[toIdx]);
            transferStations.push(transferAt);
        }

        segmentStart = i;
    }

    return {
        stations: stationPath.map((station) => STATION_DISPLAY_NAMES.get(station)),
        steps,
        transferStations
    };
};
