import React from 'react';
import s from '@styles/ModeControls.module.css';
import g from '@styles/global.module.css';

const getSpriteUrl = (filename) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${base}/assets/sprites/${filename}`;
};

const METRO_TOGGLE_SPRITE = 'brachio_west_02_idle_rainbow.png';
const WIP_EGG_SPRITE = 'EggColour4.gif';

const WIP_MODES = ['bus', 'train', 'air'];

const WIP_LABELS = {
    bus: 'Bus',
    train: 'Train',
    air: 'Air'
};

const DINO_MAP_TOGGLE_SPRITE = 'brachio_west_02_idle_rainbow.png';

const ModeControls = ({
    layers,
    selectedPanelMode,
    showAllStationLabels,
    showIntermediateStationLabels,
    onToggleAllStationLabels,
    onToggleIntermediateStationLabels,
    onMetroActivate,
    onWipModeSelect
}) => {
    const isMetroPanel = selectedPanelMode === 'metro';
    const intermediateToggleDisabled = !showAllStationLabels;

    return (
        <nav
            className={`${s.modeRail} ${s.layerControls}`}
            aria-labelledby="transit-mode-controls-heading"
            aria-describedby="transit-mode-controls-help"
        >
            <h2 id="transit-mode-controls-heading" className={g.srOnly}>
                Transit mode controls
            </h2>
            <p id="transit-mode-controls-help" className={g.srOnly}>
                Metro selects metro trip planning, turns on the metro map layer, and shows the live dino
                map with lines, station labels, and train sprites. Bus, train, and air open the planner
                in hatching status. The Dino map controls toggle visibility of station name labels on the
                map: one hides or shows intermediate stations only; the other hides or shows every station
                label including terminals and interchanges.
            </p>
            <p id="wip-layer-description" className={g.srOnly}>
                This transit layer is currently hatching and unavailable.
            </p>
            <ul className={s.layerControlList}>
                <li className={isMetroPanel && layers.metro ? s.metroRailSlotActive : ''}>
                    <button
                        type="button"
                        id="mode-control-metro"
                        onClick={onMetroActivate}
                        className={`${s.metroToggle} ${
                            isMetroPanel && layers.metro ? s.metroToggleFused : ''
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
                            className={s.metroToggleImage}
                        />
                        <span className={s.modeLabel}>Metro</span>
                        <span className={s.modeState}>{layers.metro ? 'ACTIVE' : 'OFF'}</span>
                    </button>
                </li>
                {WIP_MODES.map((mode) => (
                    <li key={mode}>
                        <button
                            type="button"
                            id={`mode-control-${mode}`}
                            onClick={() => onWipModeSelect(mode)}
                            className={`${s.modeButton} ${selectedPanelMode === mode ? s.modeButtonActive : ''} ${g.focusVisible}`}
                            aria-label={`${WIP_LABELS[mode]} mode. This transit layer is currently hatching and unavailable.`}
                            aria-pressed={selectedPanelMode === mode}
                            aria-disabled="true"
                            aria-busy="true"
                            aria-controls="metro-planner-panel"
                            aria-describedby="wip-layer-description"
                        >
                            <img
                                src={getSpriteUrl(WIP_EGG_SPRITE)}
                                alt=""
                                aria-hidden="true"
                                className={s.modeEggIcon}
                            />
                            <span className={s.modeLabel}>{WIP_LABELS[mode]}</span>
                            <span className={s.modeState}>Hatching</span>
                        </button>
                    </li>
                ))}
                <li className={s.mapRailListItem}>
                    <button
                        type="button"
                        id="mode-control-dino-map-intermediate-labels"
                        onClick={onToggleIntermediateStationLabels}
                        className={`${s.modeButton} ${s.dinoMapModeButton} ${
                            intermediateToggleDisabled ? s.dinoMapModeButtonDisabled : ''
                        } ${g.focusVisible}`}
                        disabled={intermediateToggleDisabled}
                        aria-pressed={showIntermediateStationLabels && showAllStationLabels}
                        aria-controls="dino-live-map-region"
                        aria-label={
                            intermediateToggleDisabled
                                ? 'Intermediate station labels: turn all station labels back on first to change this setting.'
                                : showIntermediateStationLabels
                                  ? 'Hide all intermediate station labels and leader lines on the map.'
                                  : 'Show all intermediate station labels and leader lines on the map.'
                        }
                    >
                        <img
                            src={getSpriteUrl(DINO_MAP_TOGGLE_SPRITE)}
                            alt=""
                            aria-hidden="true"
                            className={s.dinoMapToggleIcon}
                        />
                        <span className={`${s.modeLabel} ${s.dinoMapModeLabel}`}>DINO MAP</span>
                        <span className={s.modeState}>
                            {showIntermediateStationLabels
                                ? '> Hide all intermediate stations'
                                : '> Show all intermediate stations'}
                        </span>
                    </button>
                </li>
                <li className={s.mapRailListItem}>
                    <button
                        type="button"
                        id="mode-control-dino-map-all-labels"
                        onClick={onToggleAllStationLabels}
                        className={`${s.modeButton} ${s.dinoMapModeButton} ${g.focusVisible}`}
                        aria-pressed={showAllStationLabels}
                        aria-controls="dino-live-map-region"
                        aria-label={
                            showAllStationLabels
                                ? 'Hide every station label and leader line on the map, including terminals and interchanges.'
                                : 'Show every station label and leader line on the map.'
                        }
                    >
                        <img
                            src={getSpriteUrl(DINO_MAP_TOGGLE_SPRITE)}
                            alt=""
                            aria-hidden="true"
                            className={s.dinoMapToggleIcon}
                        />
                        <span className={`${s.modeLabel} ${s.dinoMapModeLabel}`}>DINO MAP</span>
                        <span className={s.modeState}>
                            {showAllStationLabels ? '> Hide all stations' : '> Show all stations'}
                        </span>
                    </button>
                </li>
            </ul>
        </nav>
    );
};

export default ModeControls;
