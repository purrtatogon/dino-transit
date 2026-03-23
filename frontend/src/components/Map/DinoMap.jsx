import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Client } from '@stomp/stompjs';
import 'leaflet/dist/leaflet.css';
import MetroLayer from './layers/MetroLayer';
import StationNodesLayer from './layers/StationNodesLayer';
import StationLabelsLayer from './layers/StationLabelsLayer';
import g from '@styles/global.module.css';
import m from '@styles/metro.module.css';
import { ALL_STATIONS, findMetroRoute } from './utils/metroNetwork';
import { RAW_STATIONS, dedupeStations } from './layers/stationLayerShared';

const METRO_TOGGLE_SPRITE = 'brachio_west_02_idle_rainbow.png';
const WIP_EGG_SPRITE = 'EggColour4.gif';

// false = hide station names only; the square nodes still show
const SHOW_STATION_LABELS = true;
const SHOW_STATION_NODES = true;

const EMPTY_METRO_VEHICLES = [];

const lineLabel = {
    green: 'Green',
    red: 'Red',
    blue: 'Blue',
    yellow: 'Yellow'
};

// First/last stop names per line (same order as in the line data files)
const LINE_TERMINALS = {
    green: { from: 'Telheiras', to: 'Cais do Sodré' },
    red: { from: 'São Sebastião', to: 'Aeroporto' },
    blue: { from: 'Reboleira', to: 'Santa Apolónia' },
    yellow: { from: 'Odivelas', to: 'Rato' }
};

const LINE_KEYS = ['green', 'red', 'blue', 'yellow'];

const lineToSentenceLabel = {
    green: 'Green',
    red: 'Red',
    blue: 'Blue',
    yellow: 'Yellow'
};

const modeLabel = {
    metro: 'Metro',
    bus: 'Bus',
    train: 'Train',
    air: 'Air'
};

const modeContent = {
    bus: {
        title: 'BUS STATUS',
        paragraphs: [
            'The Triceratops fleet is still in its shell!',
            'This transit layer is currently offline while we prep the streets for the herd.'
        ]
    },
    train: {
        title: 'TRAIN STATUS',
        paragraphs: [
            'The Ankylosaurus is still incubating!',
            "We're currently armoring up this rail layer for its debut on the tracks."
        ]
    },
    air: {
        title: 'AIR STATUS',
        paragraphs: [
            "The Quetzalcoatlus hasn't peeked out yet!",
            'This aerial layer is being warmed up for a smooth takeoff.'
        ]
    }
};

const MAP_VISIBLE_STORAGE_KEY = 'dino-transit-map-visible';

const readMapVisiblePreference = () => {
    if (typeof window === 'undefined') {
        return true;
    }
    try {
        const stored = window.localStorage.getItem(MAP_VISIBLE_STORAGE_KEY);
        if (stored === 'false') {
            return false;
        }
        return true;
    } catch {
        return true;
    }
};

const MapInvalidateWhenShown = ({ isShown }) => {
    const map = useMap();
    useLayoutEffect(() => {
        if (!isShown) {
            return undefined;
        }
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

const getSpriteUrl = (filename) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${base}/assets/sprites/${filename}`;
};

const getDinoSpecies = (dinoName = '') => {
    const lower = dinoName.toLowerCase();
    if (lower.includes('brachio')) {
        return 'Brachiosaurus';
    }
    if (lower.includes('ankylo')) {
        return 'Ankylosaurus';
    }
    if (lower.includes('tricer')) {
        return 'Triceratops';
    }
    if (lower.includes('quetzal')) {
        return 'Quetzalcoatlus';
    }
    return 'Dinosaur';
};

const findNearestStationName = (train, stations) => {
    const lineKey = (train.lineColor || '').toLowerCase();
    const candidateStations = stations.filter((station) => station.lines.includes(lineKey));
    const pool = candidateStations.length ? candidateStations : stations;
    if (!pool.length) {
        return 'the next station';
    }

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

const buildNaturalLanguageAnnouncement = (train, stations) => {
    const lineName = lineToSentenceLabel[(train.lineColor || '').toLowerCase()] || 'Metro';
    const dinoSpecies = getDinoSpecies(train.dinoName);
    const stationName = findNearestStationName(train, stations);
    const isBoarding = (train.status || '').toLowerCase() === 'boarding';
    if (isBoarding) {
        return `The ${lineName} Line ${dinoSpecies} is now boarding at ${stationName}.`;
    }
    return `The ${lineName} Line ${dinoSpecies} is pulling into ${stationName}.`;
};

const DinoMap = () => {
    const [transportData, setTransportData] = useState([]);
    const [liveAnnouncements, setLiveAnnouncements] = useState([]);
    const [layers, setLayers] = useState({ metro: true, bus: false, train: false, air: false });
    const [selectedPanelMode, setSelectedPanelMode] = useState('metro');
    const [isPlannerOpen, setPlannerOpen] = useState(true);
    const [fromStation, setFromStation] = useState(ALL_STATIONS[0] || '');
    const [toStation, setToStation] = useState(ALL_STATIONS[1] || '');
    const [stationFocusTick, setStationFocusTick] = useState(0);
    const [mapVisible, setMapVisible] = useState(readMapVisiblePreference);
    const previousMetroStateRef = useRef(new Map());
    const routeResultRef = useRef(null);
    const fromStationSelectRef = useRef(null);
    const wipPrimaryBtnRef = useRef(null);
    const plannerRefreshBtnRef = useRef(null);
    const prevPanelModeRef = useRef(selectedPanelMode);
    const stationDirectory = useMemo(() => dedupeStations(RAW_STATIONS), []);

    useEffect(() => {
        try {
            window.localStorage.setItem(MAP_VISIBLE_STORAGE_KEY, String(mapVisible));
        } catch {
            // localStorage can fail (private mode, quota, etc.)
        }
    }, [mapVisible]);

    useLayoutEffect(() => {
        if (!stationFocusTick || !routeResultRef.current) {
            return;
        }
        routeResultRef.current.focus();
    }, [stationFocusTick]);

    useLayoutEffect(() => {
        if (prevPanelModeRef.current === selectedPanelMode) {
            return;
        }
        prevPanelModeRef.current = selectedPanelMode;
        if (selectedPanelMode === 'metro') {
            fromStationSelectRef.current?.focus();
        } else {
            wipPrimaryBtnRef.current?.focus();
        }
    }, [selectedPanelMode]);

    useEffect(() => {
        const brokerURL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';
        const client = new Client({
            brokerURL,
            connectHeaders: {},
            debug: (str) => {
                console.log(str);
            },
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

    const metroData = useMemo(
        () => transportData.filter((item) => item.type === 'Metro'),
        [transportData]
    );

    const metroCounts = useMemo(() => {
        const acc = { green: 0, red: 0, blue: 0, yellow: 0 };
        metroData.forEach((item) => {
            const color = (item.lineColor || '').toLowerCase();
            if (acc[color] !== undefined) {
                acc[color] += 1;
            }
        });
        return acc;
    }, [metroData]);

    const routePlan = useMemo(() => findMetroRoute(fromStation, toStation), [fromStation, toStation]);

    const isMetroPanel = selectedPanelMode === 'metro';
    const selectedWipContent = modeContent[selectedPanelMode];
    const metroMirrorItems = useMemo(
        () =>
            metroData.map((train) => ({
                key: train.dinoName,
                sentence: buildNaturalLanguageAnnouncement(train, stationDirectory)
            })),
        [metroData, stationDirectory]
    );

    const statusAnnouncement = `Live dino map ${mapVisible ? 'visible' : 'hidden'}. Metro layer ${
        layers.metro ? 'enabled' : 'disabled'
    }. Active metros: ${metroData.length}. Selected mode: ${modeLabel[selectedPanelMode]}.`;

    const handleStationSelect = (stationName) => {
        setSelectedPanelMode('metro');
        setPlannerOpen(true);
        setMapVisible(true);
        setLayers((previous) => ({ ...previous, metro: true }));
        setFromStation(stationName);
        setStationFocusTick((tick) => tick + 1);
    };

    const handleRideBrachiosaurus = () => {
        setMapVisible(true);
        setLayers((previous) => ({ ...previous, metro: true }));
        setSelectedPanelMode('metro');
        setPlannerOpen(true);
    };

    const handleSwapStations = () => {
        setFromStation(toStation);
        setToStation(fromStation);
    };

    const handlePlannerRefresh = () => {
        if (isMetroPanel) {
            routeResultRef.current?.focus();
        } else {
            wipPrimaryBtnRef.current?.focus();
        }
    };

    const activeModePlannerLabel =
        selectedPanelMode === 'metro'
            ? 'Metro mode. Route planning and live line terminals.'
            : `${modeLabel[selectedPanelMode]} mode. Layer is still hatching.`;

    return (
        <main className={`${m.appShell} ${mapVisible ? '' : m.shellMapHidden}`}>
            <h1 className={g.srOnly}>Dino Transit Lisbon Metro</h1>
            <div className={g.srOnly} id="transit-live-announcer" aria-live="polite" aria-atomic="false">
                <p>{statusAnnouncement}</p>
                <ul>
                    {liveAnnouncements.map((announcement, index) => (
                        <li key={`live-announcement-${index}`}>{announcement}</li>
                    ))}
                </ul>
            </div>

            <div className={m.layoutRoot}>
                <nav
                    className={`${m.modeRail} ${m.layerControls}`}
                    aria-labelledby="transit-mode-controls-heading"
                    aria-describedby="transit-mode-controls-help"
                >
                    <h2 id="transit-mode-controls-heading" className={g.srOnly}>
                        Transit mode controls
                    </h2>
                    <p id="transit-mode-controls-help" className={g.srOnly}>
                        Metro selects metro trip planning, turns on the metro map layer, and shows the live dino
                        map with lines, station labels, and train sprites. Bus, train, and air open the planner
                        in hatching status. The last control hides or shows the live dino map.
                    </p>
                    <p id="wip-layer-description" className={g.srOnly}>
                        This transit layer is currently hatching and unavailable.
                    </p>
                    <ul className={m.layerControlList}>
                        <li
                            className={
                                isMetroPanel && layers.metro ? m.metroRailSlotActive : ''
                            }
                        >
                            <button
                                type="button"
                                id="mode-control-metro"
                                onClick={() => {
                                    setMapVisible(true);
                                    setLayers((previous) => ({ ...previous, metro: true }));
                                    setSelectedPanelMode('metro');
                                    setPlannerOpen(true);
                                }}
                                className={`${m.metroToggle} ${
                                    isMetroPanel && layers.metro ? m.metroToggleFused : ''
                                } ${g.focusVisible}`}
                                aria-pressed={layers.metro && isMetroPanel}
                                aria-label={`Metro trip planning. Metro map layer is ${
                                    layers.metro ? 'active' : 'off'
                                }. Opens the trip planner and shows the live map with metro lines, station labels, and trains.`}
                                aria-controls="metro-planner-panel"
                            >
                                <img
                                    src={getSpriteUrl(METRO_TOGGLE_SPRITE)}
                                    alt=""
                                    aria-hidden="true"
                                    className={m.metroToggleImage}
                                />
                                <span className={m.modeLabel}>Metro</span>
                                <span className={m.modeState}>{layers.metro ? 'ACTIVE' : 'OFF'}</span>
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                id="mode-control-bus"
                                onClick={() => {
                                    setSelectedPanelMode('bus');
                                    setPlannerOpen(true);
                                }}
                                className={`${m.modeButton} ${selectedPanelMode === 'bus' ? m.modeButtonActive : ''} ${g.focusVisible}`}
                                aria-label="Bus mode. This transit layer is currently hatching and unavailable."
                                aria-pressed={selectedPanelMode === 'bus'}
                                aria-disabled="true"
                                aria-busy="true"
                                aria-controls="metro-planner-panel"
                                aria-describedby="wip-layer-description"
                            >
                                <img
                                    src={getSpriteUrl(WIP_EGG_SPRITE)}
                                    alt=""
                                    aria-hidden="true"
                                    className={m.modeEggIcon}
                                />
                                <span className={m.modeLabel}>Bus</span>
                                <span className={m.modeState}>Hatching</span>
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                id="mode-control-train"
                                onClick={() => {
                                    setSelectedPanelMode('train');
                                    setPlannerOpen(true);
                                }}
                                className={`${m.modeButton} ${selectedPanelMode === 'train' ? m.modeButtonActive : ''} ${g.focusVisible}`}
                                aria-label="Train mode. This transit layer is currently hatching and unavailable."
                                aria-pressed={selectedPanelMode === 'train'}
                                aria-disabled="true"
                                aria-busy="true"
                                aria-controls="metro-planner-panel"
                                aria-describedby="wip-layer-description"
                            >
                                <img
                                    src={getSpriteUrl(WIP_EGG_SPRITE)}
                                    alt=""
                                    aria-hidden="true"
                                    className={m.modeEggIcon}
                                />
                                <span className={m.modeLabel}>Train</span>
                                <span className={m.modeState}>Hatching</span>
                            </button>
                        </li>
                        <li>
                            <button
                                type="button"
                                id="mode-control-air"
                                onClick={() => {
                                    setSelectedPanelMode('air');
                                    setPlannerOpen(true);
                                }}
                                className={`${m.modeButton} ${selectedPanelMode === 'air' ? m.modeButtonActive : ''} ${g.focusVisible}`}
                                aria-label="Air mode. This transit layer is currently hatching and unavailable."
                                aria-pressed={selectedPanelMode === 'air'}
                                aria-disabled="true"
                                aria-busy="true"
                                aria-controls="metro-planner-panel"
                                aria-describedby="wip-layer-description"
                            >
                                <img
                                    src={getSpriteUrl(WIP_EGG_SPRITE)}
                                    alt=""
                                    aria-hidden="true"
                                    className={m.modeEggIcon}
                                />
                                <span className={m.modeLabel}>Air</span>
                                <span className={m.modeState}>Hatching</span>
                            </button>
                        </li>
                        <li className={m.mapRailListItem}>
                            <button
                                type="button"
                                id="mode-control-dino-map-visibility"
                                onClick={() => setMapVisible((v) => !v)}
                                className={`${m.mapRailToggle} ${g.focusVisible}`}
                                aria-pressed={mapVisible}
                                aria-controls="dino-live-map-region"
                                aria-label={
                                    mapVisible
                                        ? 'Hide live dino map. The map is currently visible.'
                                        : 'Show live dino map. The map is currently hidden.'
                                }
                            >
                                <span className={m.mapRailToggleLabel}>
                                    {mapVisible ? 'Hide Live Dino Map' : 'Show Live Dino Map'}
                                </span>
                            </button>
                        </li>
                    </ul>
                </nav>

                <aside
                    id="metro-planner-panel"
                    className={`${m.plannerPanel} ${isPlannerOpen ? m.panelOpen : m.panelClosed}`}
                    aria-labelledby={`planner-panel-heading active-planner-mode-label mode-control-${selectedPanelMode}`}
                >
                    <h2 id="planner-panel-heading" className={g.srOnly}>
                        Trip planning
                    </h2>
                    <span id="active-planner-mode-label" className={g.srOnly}>
                        {activeModePlannerLabel}
                    </span>

                    <div className={m.plannerChrome}>
                        <header className={m.plannerHeaderBand}>
                            <p className={m.plannerBrandWordmark} aria-hidden="true">
                                Dino Transit
                            </p>
                            {isMetroPanel ? (
                                <div className={m.journeyRow}>
                                    <div className={m.journeySpine} aria-hidden="true">
                                        <span className={m.spineDot} />
                                        <span className={m.spineLine} />
                                        <span className={m.spineDot} />
                                    </div>
                                    <div className={m.journeyFields}>
                                        <label className={m.transitFieldLabel} htmlFor="fromStation">
                                            Origin
                                        </label>
                                        <select
                                            ref={fromStationSelectRef}
                                            id="fromStation"
                                            className={`${m.transitSelect} ${g.focusVisible}`}
                                            value={fromStation}
                                            onChange={(event) => setFromStation(event.target.value)}
                                        >
                                            {ALL_STATIONS.map((station) => (
                                                <option key={`from-${station}`} value={station}>
                                                    {station}
                                                </option>
                                            ))}
                                        </select>
                                        <label className={m.transitFieldLabel} htmlFor="toStation">
                                            Destination
                                        </label>
                                        <select
                                            id="toStation"
                                            className={`${m.transitSelect} ${g.focusVisible}`}
                                            value={toStation}
                                            onChange={(event) => setToStation(event.target.value)}
                                        >
                                            {ALL_STATIONS.map((station) => (
                                                <option key={`to-${station}`} value={station}>
                                                    {station}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        className={`${m.swapStationsBtn} ${g.focusVisible}`}
                                        onClick={handleSwapStations}
                                        aria-label="Swap origin and destination stations"
                                    >
                                        <span className={m.swapStationsIcon} aria-hidden="true">
                                            ⇅
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                <div className={m.wipHeaderSummary}>
                                    <p className={m.wipHeaderTitle}>{modeLabel[selectedPanelMode]} planner</p>
                                    <p className={m.wipHeaderSub}>Layer hatching — full routing will land here.</p>
                                </div>
                            )}
                        </header>

                        <div className={m.plannerToolbar}>
                            <button
                                type="button"
                                className={`${m.toolbarBtn} ${m.toolbarBtnDisabled} ${g.focusVisible}`}
                                disabled
                                aria-describedby="planner-options-hint"
                            >
                                Options
                            </button>
                            <span id="planner-options-hint" className={g.srOnly}>
                                Route filters are not available yet.
                            </span>
                            <button
                                ref={plannerRefreshBtnRef}
                                type="button"
                                className={`${m.toolbarBtn} ${g.focusVisible}`}
                                onClick={handlePlannerRefresh}
                                aria-label={
                                    isMetroPanel
                                        ? 'Refresh: move focus to suggested route summary'
                                        : 'Refresh: move focus to return to Metro action'
                                }
                            >
                                Refresh
                            </button>
                        </div>

                        <div className={m.plannerScrollBody}>
                            {isMetroPanel ? (
                                <>
                                    <p className={m.plannerBodyIntro}>
                                        Minimum-stop path between stations. Live dinos mirror the map.
                                    </p>
                                    <div
                                        id="planner-arrivals"
                                        ref={routeResultRef}
                                        className={m.routeCard}
                                        role="status"
                                        aria-live="polite"
                                        tabIndex={-1}
                                    >
                                        <h3 className={m.resultCardTitle}>Suggested route</h3>
                                        {routePlan ? (
                                            <ol className={m.stepList}>
                                                {routePlan.steps.map((step) => (
                                                    <li key={step} className={m.routeStep}>
                                                        <span className={m.routeStepLine} aria-hidden="true" />
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        ) : (
                                            <p className={m.routeEmpty}>No route found between these stations.</p>
                                        )}
                                    </div>

                                    <section
                                        className={m.liveLineActivitySection}
                                        aria-labelledby="live-line-activity-heading"
                                    >
                                        <h3
                                            id="live-line-activity-heading"
                                            className={m.resultCardTitle}
                                        >
                                            Live line activity
                                        </h3>
                                        <p className={m.plannerBodyIntro}>
                                            Each line shows its end-to-end terminals. The count below updates from
                                            the live WebSocket simulation on the map.
                                        </p>
                                        <ul className={m.pillRowList}>
                                            {LINE_KEYS.map((lineKey) => {
                                                const count = metroCounts[lineKey];
                                                const ends = LINE_TERMINALS[lineKey];
                                                const lineTitle = `${lineLabel[lineKey]} Line`;
                                                const rowLabel = `${lineTitle} — ${ends.from} ↔ ${ends.to}.`;
                                                return (
                                                    <li key={lineKey} className={m.pillRowBlock}>
                                                        <div className={m.pillRowLine}>
                                                            <span
                                                                className={`${m.linePill} ${m[`${lineKey}Pill`]}`}
                                                                aria-hidden="true"
                                                            />
                                                            <span className={m.pillRowText}>{rowLabel}</span>
                                                        </div>
                                                        <p className={m.pillRowActiveLine}>
                                                            Active brachiosaurus on this line: {count}
                                                        </p>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                </>
                            ) : (
                                <section
                                    id={`${selectedPanelMode}-status-panel`}
                                    className={m.wipStatusCard}
                                    aria-labelledby={`${selectedPanelMode}-status-title`}
                                    aria-busy="true"
                                >
                                    <div className={m.wipCardTop} role="status" aria-live="polite">
                                        <h3 id={`${selectedPanelMode}-status-title`} className={m.wipCardTitle}>
                                            {selectedWipContent.title}
                                        </h3>
                                        <p className={m.hatchingPill}>Hatching</p>
                                        <div className={m.wipIconWrap} aria-hidden="true">
                                            <img
                                                src={getSpriteUrl(WIP_EGG_SPRITE)}
                                                alt=""
                                                role="presentation"
                                                className={m.wipEggImage}
                                            />
                                        </div>
                                    </div>
                                    <div className={m.wipCardBody}>
                                        {selectedWipContent.paragraphs.map((paragraph) => (
                                            <p key={paragraph} className={m.wipText}>
                                                {paragraph}
                                            </p>
                                        ))}
                                    </div>
                                    <button
                                        ref={wipPrimaryBtnRef}
                                        type="button"
                                        className={m.primaryRideButton}
                                        onClick={handleRideBrachiosaurus}
                                        aria-label="Ride the Brachiosaurus and switch to Metro mode."
                                        aria-controls="metro-planner-panel"
                                    >
                                        Ride the Brachiosaurus
                                    </button>
                                </section>
                            )}
                        </div>
                    </div>
                </aside>

                <div className={m.mapColumn}>
                    <div className={m.topControls}>
                        <button
                            type="button"
                            className={`${m.panelToggle} ${g.focusVisible}`}
                            onClick={() => setPlannerOpen((open) => !open)}
                            aria-expanded={isPlannerOpen}
                            aria-controls="metro-planner-panel"
                        >
                            {isPlannerOpen ? 'Hide trip planner' : 'Show trip planner'}
                        </button>
                    </div>

                    <div className={`${m.mapSlot} ${mapVisible ? '' : m.mapSlotCollapsed}`}>
                        <div
                            id="dino-live-map-region"
                            className={m.mapViewport}
                            inert={!mapVisible}
                            aria-hidden={!mapVisible}
                        >
                            <MapContainer
                                center={[38.722, -9.139]}
                                zoom={13}
                                className={m.mapContainer}
                                aria-label="Lisbon metro map with live dinosaur metro icons"
                            >
                                <MapInvalidateWhenShown isShown={mapVisible} />
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    className="pixel-map-tiles"
                                />
                                {SHOW_STATION_NODES && (
                                    <StationNodesLayer onStationSelect={handleStationSelect} />
                                )}
                                {SHOW_STATION_LABELS && (
                                    <StationLabelsLayer
                                        metroVehicles={
                                            layers.metro ? metroData : EMPTY_METRO_VEHICLES
                                        }
                                    />
                                )}
                                {layers.metro && <MetroLayer data={transportData} />}
                            </MapContainer>
                        </div>
                    </div>
                </div>
            </div>

            <section className={g.srOnly} aria-labelledby="map-mirror-title">
                <h2 id="map-mirror-title">Transit map mirror</h2>
                <p>This hidden list mirrors map trains and stations for screen readers.</p>
                <ul id="sr-train-list">
                    {metroMirrorItems.map((item) => (
                        <li key={`sr-train-${item.key}`}>{item.sentence}</li>
                    ))}
                </ul>
                <h3>Station selector</h3>
                <ul>
                    {ALL_STATIONS.map((stationName) => (
                        <li key={`sr-station-${stationName}`}>
                            <button
                                type="button"
                                className={g.focusVisible}
                                onClick={() => handleStationSelect(stationName)}
                                aria-controls="metro-planner-panel"
                            >
                                Show planner details for {stationName}
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    );
};

export default DinoMap;