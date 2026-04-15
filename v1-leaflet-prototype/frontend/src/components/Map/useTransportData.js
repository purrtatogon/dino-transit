// This hook subscribes to the backend's WebSocket and keeps `transportData`
// up to date.  Each item in the array now includes:
//   - timestampEpochMs: when the position was generated (for freshness checks)
//   - source: "live" | "simulated" | "cached" | "schedule"
// The SpriteMarker component uses these to decide how to animate, and
// AppShell reads `source` to show the data-source badge.
import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';

const lineToSentenceLabel = {
    green: 'Green',
    red: 'Red',
    blue: 'Blue',
    yellow: 'Yellow'
};

const getDinoSpecies = (dinoName = '') => {
    const lower = dinoName.toLowerCase();
    if (lower.includes('brachio')) return 'Brachiosaurus';
    if (lower.includes('ankylo')) return 'Ankylosaurus';
    if (lower.includes('tricer')) return 'Triceratops';
    if (lower.includes('quetzal')) return 'Quetzalcoatlus';
    return 'Dinosaur';
};

const findNearestStationName = (train, stations) => {
    const lineKey = (train.lineColor || '').toLowerCase();
    const candidateStations = stations.filter((s) => s.lines.includes(lineKey));
    const pool = candidateStations.length ? candidateStations : stations;
    if (!pool.length) return 'the next station';

    const { latitude, longitude } = train;
    let nearest = pool[0];
    let nearestDistance = Infinity;

    pool.forEach((station) => {
        const [lat, lng] = station.coords;
        const distance = (lat - latitude) ** 2 + (lng - longitude) ** 2;
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = station;
        }
    });

    return nearest.name;
};

export const buildNaturalLanguageAnnouncement = (train, stations) => {
    const lineName = lineToSentenceLabel[(train.lineColor || '').toLowerCase()] || 'Metro';
    const dinoSpecies = getDinoSpecies(train.dinoName);
    const stationName = findNearestStationName(train, stations);
    const isBoarding = (train.status || '').toLowerCase() === 'boarding';
    if (isBoarding) {
        return `The ${lineName} Line ${dinoSpecies} is now boarding at ${stationName}.`;
    }
    return `The ${lineName} Line ${dinoSpecies} is pulling into ${stationName}.`;
};

const useTransportData = (stationDirectory) => {
    const [transportData, setTransportData] = useState([]);
    const [liveAnnouncements, setLiveAnnouncements] = useState([]);
    const previousMetroStateRef = useRef(new Map());

    useEffect(() => {
        const brokerURL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';
        const client = new Client({
            brokerURL,
            connectHeaders: {},
            // STOMP logs every frame at 2 Hz — too noisy for production and can
            // hurt performance on low-end devices.  Only log in dev mode.
            debug: import.meta.env.DEV ? (str) => console.log(str) : () => {},
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            onConnect: () => {
                console.log('Connected via Native WebSockets!');
                client.subscribe('/topic/transport', (message) => {
                    const parsedPayload = JSON.parse(message.body);
                    setTransportData(parsedPayload);

                    const metros = parsedPayload.filter((item) => item.type === 'Metro');
                    const nextMetroState = new Map();
                    const newAnnouncements = [];

                    metros.forEach((metro) => {
                        const stationName = findNearestStationName(metro, stationDirectory);
                        const previousMetro = previousMetroStateRef.current.get(metro.dinoName);
                        const hasChanged =
                            !previousMetro ||
                            previousMetro.stationName !== stationName ||
                            previousMetro.status !== metro.status;

                        nextMetroState.set(metro.dinoName, {
                            stationName,
                            status: metro.status
                        });

                        if (hasChanged) {
                            newAnnouncements.push(
                                buildNaturalLanguageAnnouncement(metro, stationDirectory)
                            );
                        }
                    });

                    previousMetroStateRef.current = nextMetroState;

                    if (newAnnouncements.length) {
                        setLiveAnnouncements((previous) =>
                            [...newAnnouncements.reverse(), ...previous].slice(0, 6)
                        );
                    }
                });
            }
        });
        client.activate();
        return () => client.deactivate();
    }, [stationDirectory]);

    return { transportData, liveAnnouncements };
};

export default useTransportData;
