package com.dinotransit.backend.provider;

import com.dinotransit.backend.config.TransitDataProperties;
import com.google.transit.realtime.GtfsRealtime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.HashSet;

/**
 * Hits the GTFS-RT feed over HTTP (protobuf). TripUpdates are optional - I use them to spot "dwelling" trains.
 */
@Component
public class GtfsRealtimeProviderClient implements TransitProviderClient {

    private static final Logger logger = LoggerFactory.getLogger(GtfsRealtimeProviderClient.class);
    private static final String EMPTY = "";

    private final TransitDataProperties properties;
    private final HttpClient httpClient;

    public GtfsRealtimeProviderClient(TransitDataProperties properties) {
        this.properties = properties;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(properties.getGtfs().getConnectTimeoutMs()))
                .build();
    }

    @Override
    public TransitFetchResult fetchVehiclePositions() {
        String url = properties.getGtfs().getVehiclePositionsUrl();
        if (url == null || url.isBlank()) {
            return TransitFetchResult.failed();
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(properties.getGtfs().getReadTimeoutMs()))
                    .GET()
                    .build();

            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("GTFS-RT vehicle positions call failed with HTTP {}", response.statusCode());
                return TransitFetchResult.failed();
            }

            GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.parseFrom(response.body());
            Set<String> dwellingTripIds = fetchDwellingTripIds();
            return TransitFetchResult.success(extractVehiclePositions(feed), dwellingTripIds);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            logger.warn("Failed to fetch GTFS-RT vehicle positions: {}", exception.getMessage());
            return TransitFetchResult.failed();
        }
    }

    private Set<String> fetchDwellingTripIds() {
        String tripUpdatesUrl = properties.getGtfs().getTripUpdatesUrl();
        if (tripUpdatesUrl == null || tripUpdatesUrl.isBlank()) {
            return Set.of();
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tripUpdatesUrl))
                    .timeout(Duration.ofMillis(properties.getGtfs().getReadTimeoutMs()))
                    .GET()
                    .build();

            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("GTFS-RT trip updates call failed with HTTP {}", response.statusCode());
                return Set.of();
            }

            GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.parseFrom(response.body());
            return extractDwellingTripIds(feed);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            logger.warn("Failed to fetch GTFS-RT trip updates: {}", exception.getMessage());
            return Set.of();
        }
    }

    private List<GtfsVehicleSnapshot> extractVehiclePositions(GtfsRealtime.FeedMessage feed) {
        List<GtfsVehicleSnapshot> snapshots = new ArrayList<>();
        for (GtfsRealtime.FeedEntity entity : feed.getEntityList()) {
            if (!entity.hasVehicle()) {
                continue;
            }

            GtfsRealtime.VehiclePosition vehicle = entity.getVehicle();
            if (!vehicle.hasPosition()) {
                continue;
            }

            String vehicleId = vehicle.hasVehicle() ? vehicle.getVehicle().getId() : entity.getId();
            String tripId = vehicle.hasTrip() ? vehicle.getTrip().getTripId() : EMPTY;
            String status = vehicle.hasCurrentStatus() ? vehicle.getCurrentStatus().name() : EMPTY;
            long timestamp = vehicle.hasTimestamp() ? vehicle.getTimestamp() : 0L;

            snapshots.add(new GtfsVehicleSnapshot(
                    vehicleId,
                    tripId,
                    vehicle.getPosition().getLatitude(),
                    vehicle.getPosition().getLongitude(),
                    status,
                    timestamp
            ));
        }
        return snapshots;
    }

    private Set<String> extractDwellingTripIds(GtfsRealtime.FeedMessage feed) {
        long nowEpochSec = System.currentTimeMillis() / 1000L;
        Set<String> dwellingTripIds = new HashSet<>();

        for (GtfsRealtime.FeedEntity entity : feed.getEntityList()) {
            if (!entity.hasTripUpdate()) {
                continue;
            }

            GtfsRealtime.TripUpdate tripUpdate = entity.getTripUpdate();
            String tripId = tripUpdate.hasTrip() ? tripUpdate.getTrip().getTripId() : EMPTY;
            if (tripId.isBlank()) {
                continue;
            }

            if (isInStationDwellWindow(tripUpdate, nowEpochSec)) {
                dwellingTripIds.add(tripId);
            }
        }

        return dwellingTripIds;
    }

    private boolean isInStationDwellWindow(GtfsRealtime.TripUpdate tripUpdate, long nowEpochSec) {
        for (GtfsRealtime.TripUpdate.StopTimeUpdate stopUpdate : tripUpdate.getStopTimeUpdateList()) {
            Long arrival = stopUpdate.hasArrival() && stopUpdate.getArrival().hasTime()
                    ? stopUpdate.getArrival().getTime()
                    : null;
            Long departure = stopUpdate.hasDeparture() && stopUpdate.getDeparture().hasTime()
                    ? stopUpdate.getDeparture().getTime()
                    : null;

            if (arrival != null && departure != null && nowEpochSec >= arrival && nowEpochSec <= departure) {
                return true;
            }

            if (arrival != null && departure == null && nowEpochSec >= arrival && nowEpochSec <= arrival + 45) {
                return true;
            }

            if (arrival == null && departure != null && nowEpochSec <= departure && nowEpochSec >= departure - 45) {
                return true;
            }
        }
        return false;
    }
}
