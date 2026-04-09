package com.dinotransit.backend.mapping;

import com.dinotransit.backend.cache.LatestVehicleStateCache;
import com.dinotransit.backend.gtfs.GtfsStaticReferenceData;
import com.dinotransit.backend.model.TransportUpdate;
import com.dinotransit.backend.provider.GtfsVehicleSnapshot;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class VehicleToTransportUpdateMapper {
    private static final long MIN_TRANSITION_MS = 800L;
    private static final long MAX_TRANSITION_MS = 7000L;
    private static final long DEFAULT_TRANSITION_MS = 1600L;

    private final LatestVehicleStateCache stateCache;

    public VehicleToTransportUpdateMapper(LatestVehicleStateCache stateCache) {
        this.stateCache = stateCache;
    }

    public List<TransportUpdate> map(
            List<GtfsVehicleSnapshot> snapshots,
            GtfsStaticReferenceData staticData,
            Set<String> dwellingTripIds
    ) {
        List<TransportUpdate> updates = new ArrayList<>();
        long nowMs = System.currentTimeMillis();
        for (GtfsVehicleSnapshot snapshot : snapshots) {
            String lineColor = resolveLineColor(snapshot.tripId(), staticData);
            if (lineColor.isBlank()) {
                lineColor = "green";
            }

            String vehicleKey = vehicleKey(snapshot);
            LatestVehicleStateCache.MotionState motionState = stateCache.motionStateFor(vehicleKey);
            LatestVehicleStateCache.Point previousRendered = new LatestVehicleStateCache.Point(
                    motionState.getLastRenderedLatitude(),
                    motionState.getLastRenderedLongitude()
            );

            LatestVehicleStateCache.Point interpolatedPoint = interpolatedPosition(snapshot, motionState, nowMs);
            String direction = directionFrom(previousRendered, interpolatedPoint.latitude(), interpolatedPoint.longitude());
            boolean dwellingFromTripUpdates = dwellingTripIds.contains(snapshot.tripId());

            TransportUpdate update = new TransportUpdate(
                    "Metro",
                    dinoName(snapshot, lineColor),
                    mapStatus(snapshot.currentStatus(), dwellingFromTripUpdates),
                    interpolatedPoint.latitude(),
                    interpolatedPoint.longitude(),
                    direction,
                    lineColor,
                    nowMs,
                    "live"
            );
            updates.add(update);
        }
        return updates;
    }

    private String resolveLineColor(String tripId, GtfsStaticReferenceData staticData) {
        if (tripId == null || tripId.isBlank()) {
            return "";
        }
        String routeId = staticData.tripToRoute().get(tripId);
        if (routeId == null || routeId.isBlank()) {
            return "";
        }
        return staticData.routeToLineColor().getOrDefault(routeId, "");
    }

    private String dinoName(GtfsVehicleSnapshot snapshot, String lineColor) {
        String vehicleId = snapshot.vehicleId() == null || snapshot.vehicleId().isBlank()
                ? snapshot.tripId()
                : snapshot.vehicleId();
        if (vehicleId == null || vehicleId.isBlank()) {
            vehicleId = "unknown";
        }
        return "Metro-" + lineColor.substring(0, 1).toUpperCase(Locale.ROOT) + "-" + vehicleId;
    }

    private String mapStatus(String sourceStatus, boolean dwellingFromTripUpdates) {
        if (dwellingFromTripUpdates) {
            return "Boarding";
        }
        if (sourceStatus == null) {
            return "Moving";
        }
        return switch (sourceStatus.toUpperCase(Locale.ROOT)) {
            case "STOPPED_AT" -> "Boarding";
            case "IN_TRANSIT_TO", "INCOMING_AT" -> "Moving";
            default -> "Moving";
        };
    }

    private String directionFrom(LatestVehicleStateCache.Point previous, double currentLatitude, double currentLongitude) {
        if (previous == null) {
            return "east";
        }
        double dy = currentLatitude - previous.latitude();
        double dx = currentLongitude - previous.longitude();

        if (Math.abs(dx) < 0.00001 && Math.abs(dy) < 0.00001) {
            return "east";
        }

        double angle = Math.toDegrees(Math.atan2(dy, dx));
        if (angle >= -45 && angle <= 45) {
            return "east";
        }
        if (angle > 45 && angle <= 135) {
            return "north";
        }
        if (angle < -45 && angle >= -135) {
            return "south";
        }
        return "west";
    }

    private LatestVehicleStateCache.Point interpolatedPosition(
            GtfsVehicleSnapshot snapshot,
            LatestVehicleStateCache.MotionState motionState,
            long nowMs
    ) {
        if (!motionState.isInitialized()) {
            initializeState(snapshot, motionState, nowMs);
            return new LatestVehicleStateCache.Point(snapshot.latitude(), snapshot.longitude());
        }

        boolean incomingTargetChanged = targetChanged(snapshot, motionState);
        if (incomingTargetChanged) {
            startTransitionToNewTarget(snapshot, motionState, nowMs);
        }

        long elapsedMs = Math.max(0L, nowMs - motionState.getTransitionStartMs());
        long durationMs = Math.max(1L, motionState.getTransitionDurationMs());
        double t = Math.min(1.0, (double) elapsedMs / durationMs);

        double lat = lerp(motionState.getStartLatitude(), motionState.getTargetLatitude(), t);
        double lng = lerp(motionState.getStartLongitude(), motionState.getTargetLongitude(), t);

        motionState.setLastRenderedLatitude(lat);
        motionState.setLastRenderedLongitude(lng);
        return new LatestVehicleStateCache.Point(lat, lng);
    }

    private void initializeState(
            GtfsVehicleSnapshot snapshot,
            LatestVehicleStateCache.MotionState motionState,
            long nowMs
    ) {
        motionState.setInitialized(true);
        motionState.setStartLatitude(snapshot.latitude());
        motionState.setStartLongitude(snapshot.longitude());
        motionState.setTransitionStartMs(nowMs);
        motionState.setTransitionDurationMs(1L);
        motionState.setTargetLatitude(snapshot.latitude());
        motionState.setTargetLongitude(snapshot.longitude());
        motionState.setTargetTimestampSec(snapshot.timestampEpochSeconds());
        motionState.setLastRenderedLatitude(snapshot.latitude());
        motionState.setLastRenderedLongitude(snapshot.longitude());
    }

    private boolean targetChanged(GtfsVehicleSnapshot snapshot, LatestVehicleStateCache.MotionState motionState) {
        return Double.compare(snapshot.latitude(), motionState.getTargetLatitude()) != 0
                || Double.compare(snapshot.longitude(), motionState.getTargetLongitude()) != 0
                || snapshot.timestampEpochSeconds() != motionState.getTargetTimestampSec();
    }

    private void startTransitionToNewTarget(
            GtfsVehicleSnapshot snapshot,
            LatestVehicleStateCache.MotionState motionState,
            long nowMs
    ) {
        long sourceDeltaMs = Math.max(
                0L,
                (snapshot.timestampEpochSeconds() - motionState.getTargetTimestampSec()) * 1000L
        );
        long transitionMs = sourceDeltaMs == 0L
                ? DEFAULT_TRANSITION_MS
                : Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, sourceDeltaMs));

        motionState.setStartLatitude(motionState.getLastRenderedLatitude());
        motionState.setStartLongitude(motionState.getLastRenderedLongitude());
        motionState.setTransitionStartMs(nowMs);
        motionState.setTransitionDurationMs(transitionMs);
        motionState.setTargetLatitude(snapshot.latitude());
        motionState.setTargetLongitude(snapshot.longitude());
        motionState.setTargetTimestampSec(snapshot.timestampEpochSeconds());
    }

    private double lerp(double start, double end, double t) {
        return start + (end - start) * t;
    }

    private String vehicleKey(GtfsVehicleSnapshot snapshot) {
        if (snapshot.vehicleId() != null && !snapshot.vehicleId().isBlank()) {
            return snapshot.vehicleId();
        }
        if (snapshot.tripId() != null && !snapshot.tripId().isBlank()) {
            return snapshot.tripId();
        }
        return "unknown";
    }
}
