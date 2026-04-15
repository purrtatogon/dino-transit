package com.dinotransit.backend.service;

import com.dinotransit.backend.gtfs.GtfsScheduleData;
import com.dinotransit.backend.gtfs.GtfsScheduleLoader;
import com.dinotransit.backend.gtfs.GtfsStaticLoader;
import com.dinotransit.backend.gtfs.GtfsStaticReferenceData;
import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

// Creates "virtual" train positions from GTFS timetable data.
// It looks at the current time of day, finds trips that should be active
// right now, and linearly interpolates a lat/lng between stops.
// This gives us deterministic, smooth positions without a live API — but
// it only works when GTFS static data is available (Metro Lisboa doesn't
// publish theirs, so this source stays empty for the Lisbon metro).
@Service
public class ScheduleTransportUpdateSource implements TransportUpdateSource {

    private static final ZoneId LISBON_ZONE = ZoneId.of("Europe/Lisbon");
    private static final int MAX_ACTIVE_PER_LINE = 6;

    private final GtfsScheduleLoader scheduleLoader;
    private final GtfsStaticLoader staticLoader;

    public ScheduleTransportUpdateSource(GtfsScheduleLoader scheduleLoader, GtfsStaticLoader staticLoader) {
        this.scheduleLoader = scheduleLoader;
        this.staticLoader = staticLoader;
    }

    @Override
    public List<TransportUpdate> getCurrentUpdates() {
        GtfsScheduleData scheduleData = scheduleLoader.current();
        GtfsStaticReferenceData staticReferenceData = staticLoader.current();
        int nowSeconds = nowSecondsOfServiceDay();

        List<CandidateUpdate> activeCandidates = new ArrayList<>();
        for (GtfsScheduleData.TripSchedule trip : scheduleData.trips()) {
            PositionStatus positionStatus = positionStatusAtTime(trip, nowSeconds);
            if (positionStatus == null) {
                continue;
            }

            String lineColor = staticReferenceData.routeToLineColor().getOrDefault(trip.routeId(), "green");
            String tripId = trip.tripId();
            String dinoName = "Metro-" + lineColor.substring(0, 1).toUpperCase(Locale.ROOT) + "-SCH-" + tripId;
            String direction = directionFrom(
                    positionStatus.fromLatitude(),
                    positionStatus.fromLongitude(),
                    positionStatus.toLatitude(),
                    positionStatus.toLongitude()
            );

            TransportUpdate update = new TransportUpdate(
                    "Metro",
                    dinoName,
                    positionStatus.status(),
                    positionStatus.latitude(),
                    positionStatus.longitude(),
                    direction,
                    lineColor,
                    System.currentTimeMillis(),
                    "schedule"
            );
            activeCandidates.add(new CandidateUpdate(lineColor, update, positionStatus.sortDistance()));
        }

        return pickTopByLine(activeCandidates);
    }

    private List<TransportUpdate> pickTopByLine(List<CandidateUpdate> candidates) {
        Map<String, List<CandidateUpdate>> byLine = new HashMap<>();
        for (CandidateUpdate candidate : candidates) {
            byLine.computeIfAbsent(candidate.lineColor(), ignored -> new ArrayList<>()).add(candidate);
        }

        List<TransportUpdate> picked = new ArrayList<>();
        for (Map.Entry<String, List<CandidateUpdate>> entry : byLine.entrySet()) {
            List<CandidateUpdate> lineCandidates = entry.getValue();
            lineCandidates.sort(Comparator.comparingLong(CandidateUpdate::sortDistance));
            int cap = Math.min(MAX_ACTIVE_PER_LINE, lineCandidates.size());
            for (int i = 0; i < cap; i += 1) {
                picked.add(lineCandidates.get(i).update());
            }
        }
        return picked;
    }

    private PositionStatus positionStatusAtTime(GtfsScheduleData.TripSchedule trip, int nowSeconds) {
        List<GtfsScheduleData.StopSchedule> stops = trip.stops();
        int firstStart = stops.get(0).departureSeconds();
        int lastEnd = stops.get(stops.size() - 1).arrivalSeconds();
        if (nowSeconds < firstStart || nowSeconds > lastEnd) {
            return null;
        }

        for (int i = 0; i < stops.size(); i += 1) {
            GtfsScheduleData.StopSchedule current = stops.get(i);
            int arrival = current.arrivalSeconds();
            int departure = current.departureSeconds();
            if (nowSeconds >= arrival && nowSeconds <= departure) {
                double fromLat = i > 0 ? stops.get(i - 1).latitude() : current.latitude();
                double fromLng = i > 0 ? stops.get(i - 1).longitude() : current.longitude();
                double toLat = i + 1 < stops.size() ? stops.get(i + 1).latitude() : current.latitude();
                double toLng = i + 1 < stops.size() ? stops.get(i + 1).longitude() : current.longitude();
                long dwellCenter = (arrival + departure) / 2L;
                return new PositionStatus(
                        current.latitude(),
                        current.longitude(),
                        "Boarding",
                        fromLat,
                        fromLng,
                        toLat,
                        toLng,
                        Math.abs(nowSeconds - dwellCenter)
                );
            }

            if (i + 1 < stops.size()) {
                GtfsScheduleData.StopSchedule next = stops.get(i + 1);
                int travelStart = departure;
                int travelEnd = next.arrivalSeconds();
                if (nowSeconds >= travelStart && nowSeconds < travelEnd && travelEnd > travelStart) {
                    double t = (double) (nowSeconds - travelStart) / (travelEnd - travelStart);
                    double lat = lerp(current.latitude(), next.latitude(), t);
                    double lng = lerp(current.longitude(), next.longitude(), t);
                    long travelCenter = (travelStart + travelEnd) / 2L;
                    return new PositionStatus(
                            lat,
                            lng,
                            "Moving",
                            current.latitude(),
                            current.longitude(),
                            next.latitude(),
                            next.longitude(),
                            Math.abs(nowSeconds - travelCenter)
                    );
                }
            }
        }

        return null;
    }

    private int nowSecondsOfServiceDay() {
        LocalDateTime now = LocalDateTime.now(LISBON_ZONE);
        return now.getHour() * 3600 + now.getMinute() * 60 + now.getSecond();
    }

    private double lerp(double start, double end, double t) {
        return start + (end - start) * t;
    }

    private String directionFrom(double fromLat, double fromLng, double toLat, double toLng) {
        double dy = toLat - fromLat;
        double dx = toLng - fromLng;
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

    private record CandidateUpdate(
            String lineColor,
            TransportUpdate update,
            long sortDistance
    ) {
    }

    private record PositionStatus(
            double latitude,
            double longitude,
            String status,
            double fromLatitude,
            double fromLongitude,
            double toLatitude,
            double toLongitude,
            long sortDistance
    ) {
    }
}
