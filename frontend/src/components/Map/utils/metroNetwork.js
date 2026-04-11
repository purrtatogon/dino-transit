import { METRO_LINES } from '../data/metroLines';

const LINE_STATION_MAP = Object.fromEntries(
    METRO_LINES.map((line) => [line.key, line.stations])
);

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

    Object.entries(LINE_STATION_MAP).forEach(([line, stations]) => {
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

const LINE_DISPLAY_NAME = {
    green: 'Green',
    red: 'Red',
    blue: 'Blue',
    yellow: 'Yellow'
};

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
            steps: [{ lineKey: null, text: `You are already at ${stationName}.` }]
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
        const lineName = LINE_DISPLAY_NAME[line] || line;
        steps.push({
            lineKey: line,
            text: `Take the ${lineName} line from ${startStation} to ${endStation} (${stopCount} ${
                stopCount === 1 ? 'stop' : 'stops'
            }).`
        });

        segmentStart = i;
    }

    return { steps };
};
