package com.dinotransit.backend.provider;

public record GtfsVehicleSnapshot(
        String vehicleId,
        String tripId,
        double latitude,
        double longitude,
        String currentStatus,
        long timestampEpochSeconds
) {
}
