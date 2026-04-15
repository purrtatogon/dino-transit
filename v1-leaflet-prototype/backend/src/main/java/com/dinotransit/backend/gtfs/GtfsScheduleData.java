package com.dinotransit.backend.gtfs;

import java.util.List;

public record GtfsScheduleData(
        List<TripSchedule> trips
) {
    public static GtfsScheduleData empty() {
        return new GtfsScheduleData(List.of());
    }

    public record TripSchedule(
            String tripId,
            String routeId,
            List<StopSchedule> stops
    ) {
    }

    public record StopSchedule(
            String stopId,
            double latitude,
            double longitude,
            int arrivalSeconds,
            int departureSeconds,
            int sequence
    ) {
    }
}
