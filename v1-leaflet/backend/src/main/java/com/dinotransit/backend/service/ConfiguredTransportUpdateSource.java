package com.dinotransit.backend.service;

import com.dinotransit.backend.cache.LatestVehicleStateCache;
import com.dinotransit.backend.config.TransitDataProperties;
import com.dinotransit.backend.model.TransportUpdate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

/** This is the main {@link TransportUpdateSource} — picks the mode and runs the fallback ladder. */
@Service
@Primary
public class ConfiguredTransportUpdateSource implements TransportUpdateSource {

    private static final Logger logger = LoggerFactory.getLogger(ConfiguredTransportUpdateSource.class);

    private final TransitDataProperties properties;
    private final SimulatorTransportUpdateSource simulatorTransportUpdateSource;
    private final GtfsTransportUpdateSource gtfsTransportUpdateSource;
    private final MetroLisboaTransportUpdateSource metroLisboaTransportUpdateSource;
    private final ScheduleTransportUpdateSource scheduleTransportUpdateSource;
    private final LatestVehicleStateCache stateCache;

    public ConfiguredTransportUpdateSource(
            TransitDataProperties properties,
            SimulatorTransportUpdateSource simulatorTransportUpdateSource,
            GtfsTransportUpdateSource gtfsTransportUpdateSource,
            MetroLisboaTransportUpdateSource metroLisboaTransportUpdateSource,
            ScheduleTransportUpdateSource scheduleTransportUpdateSource,
            LatestVehicleStateCache stateCache
    ) {
        this.properties = properties;
        this.simulatorTransportUpdateSource = simulatorTransportUpdateSource;
        this.gtfsTransportUpdateSource = gtfsTransportUpdateSource;
        this.metroLisboaTransportUpdateSource = metroLisboaTransportUpdateSource;
        this.scheduleTransportUpdateSource = scheduleTransportUpdateSource;
        this.stateCache = stateCache;
    }

    @Override
    public List<TransportUpdate> getCurrentUpdates() {
        String mode = properties.getMode().toLowerCase(Locale.ROOT);
        if ("gtfs".equals(mode)) {
            return getGtfsOrFallback();
        }
        if ("metrolisboa".equals(mode)) {
            return getMetroLisboaOrFallback();
        }
        if ("schedule".equals(mode)) {
            return scheduleTransportUpdateSource.getCurrentUpdates();
        }
        return simulatorTransportUpdateSource.getCurrentUpdates();
    }

    private List<TransportUpdate> getMetroLisboaOrFallback() {
        List<TransportUpdate> updates = metroLisboaTransportUpdateSource.getCurrentUpdates();
        if (!updates.isEmpty()) {
            stateCache.setLastKnownGoodUpdates(updates);
            return updates;
        }
        return fallbackData();
    }

    private List<TransportUpdate> getGtfsOrFallback() {
        if (!properties.getGtfs().isEnabled()) {
            return fallbackData();
        }

        GtfsTransportUpdateSource.GtfsMappedFetchResult gtfsResult = gtfsTransportUpdateSource.fetchCurrentUpdates();
        List<TransportUpdate> gtfsUpdates = gtfsResult.updates();

        if (!gtfsResult.fetchSuccessful()) {
            return fallbackData();
        }

        if (!gtfsUpdates.isEmpty()) {
            stateCache.setLastKnownGoodUpdates(gtfsUpdates);
        }
        return gtfsUpdates;
    }

    // Fallback order (don't shuffle this):
    // 1) last batch I saved from when things still worked (stale but real coords)
    // 2) GTFS timetable guess if I have static data
    // 3) simulator so the UI isn't empty
    private List<TransportUpdate> fallbackData() {
        if (properties.getFallback().isPublishLastKnownGood()) {
            List<TransportUpdate> cached = stateCache.getLastKnownGoodUpdates();
            if (!cached.isEmpty()) {
                logger.info("Fallback: returning {} cached (stale) update(s)", cached.size());
                return asStale(cached);
            }
        }

        if (properties.getFallback().isScheduleEnabled()) {
            List<TransportUpdate> scheduled = scheduleTransportUpdateSource.getCurrentUpdates();
            if (!scheduled.isEmpty()) {
                logger.info("Fallback: returning {} schedule-based update(s)", scheduled.size());
                return scheduled;
            }
        }
        if (properties.getFallback().isSimulatorEnabled()) {
            List<TransportUpdate> sim = simulatorTransportUpdateSource.getCurrentUpdates();
            logger.info("Fallback: returning {} simulated update(s)", sim.size());
            return sim;
        }
        logger.warn("Fallback: all sources exhausted, returning empty");
        return List.of();
    }

    // Replay the last good batch but flag source as "cached" + keep the old
    // timestamp so the badge can show it's stale.
    private List<TransportUpdate> asStale(List<TransportUpdate> cached) {
        return cached.stream()
                .map(update -> new TransportUpdate(
                        update.type(),
                        update.dinoName(),
                        "Stale",
                        update.latitude(),
                        update.longitude(),
                        update.direction(),
                        update.lineColor(),
                        update.timestampEpochMs(),
                        "cached"
                ))
                .toList();
    }
}
