import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import g from '@styles/global.module.css';
import s from '@styles/AppShell.module.css';
import { ALL_STATIONS, findMetroRoute } from './utils/metroNetwork';
import { RAW_STATIONS, dedupeStations } from './utils/stationUtils';
import useTransportData, { buildNaturalLanguageAnnouncement } from './useTransportData';
import LiveAnnouncer from './LiveAnnouncer';
import ModeControls from './ModeControls';
import PlannerPanel from './PlannerPanel';
import LiveDinoMap from './LiveDinoMap';

const modeLabel = {
    metro: 'Metro',
    bus: 'Bus',
    train: 'Train',
    air: 'Air'
};

const STATION_LABELS_ALL_VISIBLE_KEY = 'dino-transit-station-labels-all-visible';
const STATION_LABELS_INTERMEDIATE_VISIBLE_KEY = 'dino-transit-station-labels-intermediate-visible';

// Friendly labels for the data source badge.
// Shows people reviewing the portfolio (or using the app) where the position
// data is actually coming from — real API, schedule, or simulated.
const sourceLabel = {
    live: 'Live',
    cached: 'Cached',
    schedule: 'Schedule',
    simulated: 'Simulated'
};

const readBoolPreference = (key, defaultValue = true) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
        const stored = window.localStorage.getItem(key);
        if (stored === null) return defaultValue;
        return stored === 'true';
    } catch {
        return defaultValue;
    }
};

const isRealtimeActiveMetro = (train) => {
    const status = (train.status || '').toLowerCase();
    return status === 'moving' || status === 'boarding';
};

const AppShell = () => {
    const [layers, setLayers] = useState({ metro: true, bus: false, train: false, air: false });
    const [selectedPanelMode, setSelectedPanelMode] = useState('metro');
    const [isPlannerOpen, setPlannerOpen] = useState(true);
    const [fromStation, setFromStation] = useState('');
    const [toStation, setToStation] = useState('');
    const [stationFocusTick, setStationFocusTick] = useState(0);
    const [showAllStationLabels, setShowAllStationLabels] = useState(() =>
        readBoolPreference(STATION_LABELS_ALL_VISIBLE_KEY, true)
    );
    const [showIntermediateStationLabels, setShowIntermediateStationLabels] = useState(() =>
        readBoolPreference(STATION_LABELS_INTERMEDIATE_VISIBLE_KEY, false)
    );

    const routeResultRef = useRef(null);
    const fromStationSelectRef = useRef(null);
    const wipPrimaryBtnRef = useRef(null);
    const plannerRefreshBtnRef = useRef(null);
    const prevPanelModeRef = useRef(selectedPanelMode);

    const stationDirectory = useMemo(() => dedupeStations(RAW_STATIONS), []);
    const metroStationsForPlanner = useMemo(
        () => [...stationDirectory].sort((a, b) => a.name.localeCompare(b.name)),
        [stationDirectory]
    );
    const { transportData, liveAnnouncements } = useTransportData(stationDirectory);

    useEffect(() => {
        try {
            window.localStorage.setItem(STATION_LABELS_ALL_VISIBLE_KEY, String(showAllStationLabels));
        } catch {
            /* localStorage can fail (private mode, quota, etc.) */
        }
    }, [showAllStationLabels]);

    useEffect(() => {
        try {
            window.localStorage.setItem(
                STATION_LABELS_INTERMEDIATE_VISIBLE_KEY,
                String(showIntermediateStationLabels)
            );
        } catch {
            /* localStorage can fail (private mode, quota, etc.) */
        }
    }, [showIntermediateStationLabels]);

    useLayoutEffect(() => {
        if (!stationFocusTick || !routeResultRef.current) return;
        routeResultRef.current.focus();
    }, [stationFocusTick]);

    useLayoutEffect(() => {
        if (prevPanelModeRef.current === selectedPanelMode) return;
        prevPanelModeRef.current = selectedPanelMode;
        if (selectedPanelMode === 'metro') {
            fromStationSelectRef.current?.focus();
        } else {
            wipPrimaryBtnRef.current?.focus();
        }
    }, [selectedPanelMode]);

    const metroData = useMemo(
        () => transportData.filter((item) => item.type === 'Metro'),
        [transportData]
    );

    const metroCounts = useMemo(() => {
        const acc = { green: 0, red: 0, blue: 0, yellow: 0 };
        metroData.forEach((item) => {
            if (!isRealtimeActiveMetro(item)) return;
            const color = (item.lineColor || '').toLowerCase();
            if (acc[color] !== undefined) acc[color] += 1;
        });
        return acc;
    }, [metroData]);

    const activeRealtimeMetroCount = useMemo(
        () => metroData.filter(isRealtimeActiveMetro).length,
        [metroData]
    );

    // Figure out which data source is powering the map right now.
    // Every update carries a `source` field ("live", "simulated", "cached",
    // "schedule").  We pick the most common one from the current batch.
    const dataSource = useMemo(() => {
        if (!metroData.length) return null;
        const counts = {};
        metroData.forEach((item) => {
            const src = item.source || 'unknown';
            counts[src] = (counts[src] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }, [metroData]);

    const routePlan = useMemo(
        () => findMetroRoute(fromStation, toStation),
        [fromStation, toStation]
    );

    const metroMirrorItems = useMemo(
        () =>
            metroData.map((train) => ({
                key: train.dinoName,
                sentence: buildNaturalLanguageAnnouncement(train, stationDirectory)
            })),
        [metroData, stationDirectory]
    );

    const dataSourceLabel = dataSource ? sourceLabel[dataSource] || dataSource : 'none yet';
    const statusAnnouncement = `Station labels ${
        showAllStationLabels ? 'on for all stations' : 'hidden for all stations'
    }; intermediate labels ${
        showIntermediateStationLabels ? 'on' : 'off'
    }. Metro layer ${layers.metro ? 'enabled' : 'disabled'}. Active metros: ${activeRealtimeMetroCount}. Metro data source: ${dataSourceLabel}. Selected mode: ${modeLabel[selectedPanelMode]}.`;

    const handleStationSelect = (stationName) => {
        setSelectedPanelMode('metro');
        setPlannerOpen(true);
        setLayers((prev) => ({ ...prev, metro: true }));
        setFromStation(stationName);
        setStationFocusTick((tick) => tick + 1);
    };

    const handleMetroActivate = () => {
        setLayers((prev) => ({ ...prev, metro: true }));
        setSelectedPanelMode('metro');
        setPlannerOpen(true);
    };

    const handleWipModeSelect = (mode) => {
        setSelectedPanelMode(mode);
        setPlannerOpen(true);
    };

    const handleRideBrachiosaurus = () => {
        setLayers((prev) => ({ ...prev, metro: true }));
        setSelectedPanelMode('metro');
        setPlannerOpen(true);
    };

    const handleSwapStations = useCallback(() => {
        setFromStation(toStation);
        setToStation(fromStation);
    }, [fromStation, toStation]);

    const handlePlannerRefresh = () => {
        setFromStation('');
        setToStation('');
        const focusMetroOrigin = () => fromStationSelectRef.current?.focus();
        const focusWipReturn = () => wipPrimaryBtnRef.current?.focus();
        if (selectedPanelMode === 'metro') {
            requestAnimationFrame(focusMetroOrigin);
        } else {
            requestAnimationFrame(focusWipReturn);
        }
    };

    return (
        <main className={s.appShell}>
            <h1 className={g.srOnly}>Dino Transit Lisbon Metro</h1>

            <div
                className={s.prototypeBanner}
                role="region"
                aria-label="Construction. You are viewing the version 1 prototype built with Leaflet. A Mapbox-powered version 2 is in development and will be available soon."
            >
                <p className={s.prototypeBannerText}>
                    <span className={s.prototypeBannerIcon} aria-hidden="true">
                        🚧
                    </span>
                    <span className={s.prototypeBannerMessage}>
                        v1 prototype (Leaflet). Mapbox v2 in development — coming soon.
                    </span>
                </p>
            </div>

            {dataSource && (
                <div
                    className={`${s.sourceBadge} ${s[`source_${dataSource}`] || ''}`}
                    role="status"
                    tabIndex="0"
                    aria-label={`Current metro data source for positions: ${sourceLabel[dataSource] || dataSource}. Default backend mode is simulated smooth motion; live or schedule only appear when the server is configured for those feeds.`}
                >
                    <span className={s.sourceDot} aria-hidden="true" />
                    <span>
                        Metro positions: <strong>{sourceLabel[dataSource] || dataSource}</strong>
                    </span>
                </div>
            )}

            <LiveAnnouncer
                statusAnnouncement={statusAnnouncement}
                liveAnnouncements={liveAnnouncements}
                metroMirrorItems={metroMirrorItems}
                allStations={ALL_STATIONS}
                onStationSelect={handleStationSelect}
            />

            <div className={s.layoutRoot}>
                <ModeControls
                    layers={layers}
                    selectedPanelMode={selectedPanelMode}
                    showAllStationLabels={showAllStationLabels}
                    showIntermediateStationLabels={showIntermediateStationLabels}
                    onToggleAllStationLabels={() => setShowAllStationLabels((v) => !v)}
                    onToggleIntermediateStationLabels={() =>
                        setShowIntermediateStationLabels((v) => !v)
                    }
                    onMetroActivate={handleMetroActivate}
                    onWipModeSelect={handleWipModeSelect}
                />

                <PlannerPanel
                    isPlannerOpen={isPlannerOpen}
                    selectedPanelMode={selectedPanelMode}
                    fromStation={fromStation}
                    toStation={toStation}
                    metroStations={metroStationsForPlanner}
                    routePlan={routePlan}
                    metroCounts={metroCounts}
                    onFromStationChange={setFromStation}
                    onToStationChange={setToStation}
                    onSwapStations={handleSwapStations}
                    onPlannerRefresh={handlePlannerRefresh}
                    onRideBrachiosaurus={handleRideBrachiosaurus}
                    fromStationSelectRef={fromStationSelectRef}
                    routeResultRef={routeResultRef}
                    wipPrimaryBtnRef={wipPrimaryBtnRef}
                    plannerRefreshBtnRef={plannerRefreshBtnRef}
                />

                <LiveDinoMap
                    layers={layers}
                    transportData={transportData}
                    isPlannerOpen={isPlannerOpen}
                    onStationSelect={handleStationSelect}
                    onPlannerToggle={() => setPlannerOpen((open) => !open)}
                    showAllStationLabels={showAllStationLabels}
                    showIntermediateStationLabels={showIntermediateStationLabels}
                />
            </div>
        </main>
    );
};

export default AppShell;
