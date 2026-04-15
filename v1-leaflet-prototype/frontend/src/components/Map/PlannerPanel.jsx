import React from 'react';
import s from '@styles/PlannerPanel.module.css';
import g from '@styles/global.module.css';
import MetroStationSelect from './MetroStationSelect';

const getSpriteUrl = (filename) => {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return `${base}/assets/sprites/${filename}`;
};

const WIP_EGG_SPRITE = 'EggColour4.gif';

const LINE_KEYS = ['green', 'red', 'blue', 'yellow'];

const ORIGIN_PLACEHOLDER = 'Pick an origin station!';
const DESTINATION_PLACEHOLDER = 'Pick a destination station!';

const lineLabel = {
    green: 'Green',
    red: 'Red',
    blue: 'Blue',
    yellow: 'Yellow'
};

const LINE_TERMINALS = {
    green: { from: 'Telheiras', to: 'Cais do Sodré' },
    red: { from: 'São Sebastião', to: 'Aeroporto' },
    blue: { from: 'Reboleira', to: 'Santa Apolónia' },
    yellow: { from: 'Odivelas', to: 'Rato' }
};

const LINE_BRACHIO_EAST_IDLE = {
    green: 'brachio_greenline_east_idle.png',
    red: 'brachio_redline_east_idle.png',
    blue: 'brachio_blueline_east_idle.png',
    yellow: 'brachio_yellowline_east_idle.png'
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

const PlannerPanel = ({
    isPlannerOpen,
    selectedPanelMode,
    fromStation,
    toStation,
    metroStations,
    routePlan,
    metroCounts,
    onFromStationChange,
    onToStationChange,
    onSwapStations,
    onPlannerRefresh,
    onRideBrachiosaurus,
    fromStationSelectRef,
    routeResultRef,
    wipPrimaryBtnRef,
    plannerRefreshBtnRef
}) => {
    const isMetroPanel = selectedPanelMode === 'metro';
    const selectedWipContent = modeContent[selectedPanelMode];

    const activeModePlannerLabel =
        isMetroPanel
            ? 'Metro mode. Route planning and live line terminals.'
            : `${modeLabel[selectedPanelMode]} mode. Layer is still hatching.`;

    return (
        <aside
            id="metro-planner-panel"
            className={`${s.plannerPanel} ${isPlannerOpen ? s.panelOpen : s.panelClosed}`}
            aria-labelledby={`planner-panel-heading active-planner-mode-label mode-control-${selectedPanelMode}`}
        >
            <h2 id="planner-panel-heading" className={g.srOnly}>
                Trip planning
            </h2>
            <span id="active-planner-mode-label" className={g.srOnly}>
                {activeModePlannerLabel}
            </span>

            <div className={s.plannerChrome}>
                <header className={s.plannerHeaderBand}>
                    <p className={s.plannerBrandWordmark} aria-hidden="true">
                        DINO-TRANSIT v1.0
                    </p>
                    {isMetroPanel ? (
                        <>
                        <p className={s.panelModeTitle}>METRO PLANNER</p>
                        <div className={s.journeyRow}>
                            <div className={s.journeyBody}>
                                <div className={s.journeyTrack} aria-hidden="true">
                                    <div className={s.spineSpacerTop} />
                                    <span className={s.trackEnd} />
                                    <span className={s.trackRail} />
                                    <span className={s.trackEnd} />
                                    <div className={s.spineSpacerBottom} />
                                </div>
                                <div className={s.journeyFields}>
                                <label
                                    className={s.transitFieldLabel}
                                    id="fromStation-label"
                                    htmlFor="fromStation"
                                >
                                    Origin
                                </label>
                                <MetroStationSelect
                                    ref={fromStationSelectRef}
                                    id="fromStation"
                                    labelId="fromStation-label"
                                    stations={metroStations}
                                    value={fromStation}
                                    onChange={onFromStationChange}
                                    placeholder={ORIGIN_PLACEHOLDER}
                                />
                                <label
                                    className={s.transitFieldLabel}
                                    id="toStation-label"
                                    htmlFor="toStation"
                                >
                                    Destination
                                </label>
                                <MetroStationSelect
                                    id="toStation"
                                    labelId="toStation-label"
                                    stations={metroStations}
                                    value={toStation}
                                    onChange={onToStationChange}
                                    placeholder={DESTINATION_PLACEHOLDER}
                                />
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`${s.swapStationsBtn} ${g.focusVisible}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    onSwapStations();
                                }}
                                aria-label="Swap origin and destination stations"
                            >
                                <span className={s.swapStationsIcon} aria-hidden="true">
                                    ⇅
                                </span>
                            </button>
                        </div>
                        </>
                    ) : (
                        <>
                        <p className={s.panelModeTitle}>{modeLabel[selectedPanelMode].toUpperCase()} PLANNER</p>
                        <div className={s.wipHeaderSummary}>
                            <p className={s.wipHeaderSub}>Layer hatching — full routing will land here.</p>
                        </div>
                        </>
                    )}
                </header>

                <div className={s.plannerToolbar}>
                    <button
                        ref={plannerRefreshBtnRef}
                        type="button"
                        className={`${s.toolbarBtn} ${s.toolbarBtnRefresh} ${g.focusVisible}`}
                        onClick={onPlannerRefresh}
                        aria-label={
                            isMetroPanel
                                ? 'Clear origin and destination stations, then move focus to the origin station menu.'
                                : 'Clear stored origin and destination stations, then move focus to return to Metro.'
                        }
                    >
                        Refresh
                    </button>
                </div>

                <div className={s.plannerScrollBody}>
                    {isMetroPanel ? (
                        <>
                            <div
                                id="planner-arrivals"
                                ref={routeResultRef}
                                className={s.routeCard}
                                role="status"
                                aria-live="polite"
                                tabIndex={-1}
                            >
                                <h3 className={`${s.resultCardTitle} ${s.suggestedRouteTitle}`}>
                                    SUGGESTED ROUTE
                                </h3>
                                {routePlan ? (
                                    <ol className={s.stepList}>
                                        {routePlan.steps.map((step, index) => {
                                            const lineKey = step.lineKey;
                                            const stepText = step.text;
                                            const sprite =
                                                lineKey && LINE_BRACHIO_EAST_IDLE[lineKey]
                                                    ? getSpriteUrl(LINE_BRACHIO_EAST_IDLE[lineKey])
                                                    : null;
                                            return (
                                                <li
                                                    key={`${index}-${stepText}`}
                                                    className={s.routeStep}
                                                >
                                                    {sprite ? (
                                                        <img
                                                            src={sprite}
                                                            alt=""
                                                            aria-hidden="true"
                                                            className={s.routeStepDino}
                                                        />
                                                    ) : (
                                                        <span
                                                            className={s.routeStepDinoSpacer}
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    <span className={s.routeStepText}>{stepText}</span>
                                                </li>
                                            );
                                        })}
                                    </ol>
                                ) : !fromStation || !toStation ? (
                                    <p className={s.routeEmpty}>
                                        {!fromStation && !toStation
                                            ? 'Choose an origin and a destination to see a suggested route.'
                                            : !fromStation
                                              ? 'Pick an origin station to see a suggested route.'
                                              : 'Pick a destination station to see a suggested route.'}
                                    </p>
                                ) : (
                                    <p className={s.routeEmpty}>No route found between these stations.</p>
                                )}
                            </div>

                            {(!fromStation || !toStation) && (
                                <section
                                    className={s.liveLineActivitySection}
                                    aria-labelledby="live-line-activity-heading"
                                >
                                    <h3
                                        id="live-line-activity-heading"
                                        className={s.liveLineActivityTitleRow}
                                    >
                                        <span className={s.liveLineActivityTitleSuffix}>
                                            METRO LINE ACTIVITY:
                                        </span>{' '}
                                        <span className={s.liveLineIntroInline}>
                                            Each line shows its end-to-end terminals.
                                        </span>
                                    </h3>
                                    <ul className={s.pillRowList}>
                                        {LINE_KEYS.map((lineKey) => {
                                            const count = metroCounts[lineKey];
                                            const ends = LINE_TERMINALS[lineKey];
                                            const lineTitle = `${lineLabel[lineKey]} Line`;
                                            const rowLabel = `${lineTitle} — ${ends.from} ↔ ${ends.to}`;
                                            return (
                                                <li key={lineKey} className={s.pillRowBlock}>
                                                    <div className={s.pillRowLine}>
                                                        <img
                                                            src={getSpriteUrl(LINE_BRACHIO_EAST_IDLE[lineKey])}
                                                            alt=""
                                                            aria-hidden="true"
                                                            className={s.lineDinoIcon}
                                                        />
                                                        <div className={s.pillRowTextColumn}>
                                                            <span className={s.pillRowText}>{rowLabel}</span>
                                                            <p className={s.pillRowActiveLine}>
                                                                Active brachiosaurus on this line: {count}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            )}
                        </>
                    ) : (
                        <section
                            id={`${selectedPanelMode}-status-panel`}
                            className={s.wipStatusCard}
                            aria-labelledby={`${selectedPanelMode}-status-title`}
                            aria-busy="true"
                        >
                            <div className={s.wipCardTop} role="status" aria-live="polite">
                                <h3 id={`${selectedPanelMode}-status-title`} className={s.wipCardTitle}>
                                    {selectedWipContent.title}
                                </h3>
                                <p className={s.hatchingPill}>Hatching</p>
                                <div className={s.wipIconWrap} aria-hidden="true">
                                    <img
                                        src={getSpriteUrl(WIP_EGG_SPRITE)}
                                        alt=""
                                        role="presentation"
                                        className={s.wipEggImage}
                                    />
                                </div>
                            </div>
                            <div className={s.wipCardBody}>
                                {selectedWipContent.paragraphs.map((paragraph) => (
                                    <p key={paragraph} className={s.wipText}>
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                            <button
                                ref={wipPrimaryBtnRef}
                                type="button"
                                className={s.primaryRideButton}
                                onClick={onRideBrachiosaurus}
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
    );
};

export default PlannerPanel;
