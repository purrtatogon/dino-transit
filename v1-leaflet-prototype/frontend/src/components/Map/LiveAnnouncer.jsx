import React from 'react';
import g from '@styles/global.module.css';

const LiveAnnouncer = ({
    statusAnnouncement,
    liveAnnouncements,
    metroMirrorItems,
    allStations,
    onStationSelect
}) => (
    <>
        <div className={g.srOnly} id="transit-live-announcer" aria-live="polite" aria-atomic="false">
            <p>{statusAnnouncement}</p>
            <ul>
                {liveAnnouncements.map((announcement, index) => (
                    <li key={`live-announcement-${index}`}>{announcement}</li>
                ))}
            </ul>
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
                {allStations.map((stationName) => (
                    <li key={`sr-station-${stationName}`}>
                        <button
                            type="button"
                            className={g.focusVisible}
                            onClick={() => onStationSelect(stationName)}
                            aria-controls="metro-planner-panel"
                        >
                            Show planner details for {stationName}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    </>
);

export default LiveAnnouncer;
