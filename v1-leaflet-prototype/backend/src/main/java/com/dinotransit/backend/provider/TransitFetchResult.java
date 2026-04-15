package com.dinotransit.backend.provider;

import java.util.List;
import java.util.Set;

public record TransitFetchResult(
    boolean successful,
    List<GtfsVehicleSnapshot> snapshots,
    Set<String> dwellingTripIds
) {
    public static TransitFetchResult success(List<GtfsVehicleSnapshot> snapshots, Set<String> dwellingTripIds) {
        return new TransitFetchResult(true, snapshots, dwellingTripIds);
    }

    public static TransitFetchResult failed() {
        return new TransitFetchResult(false, List.of(), Set.of());
    }
}
