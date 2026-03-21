package com.dinotransit.backend.provider;

/** Whatever is fetching vehicle positions today (for me it's mostly the GTFS-RT HTTP client). */
public interface TransitProviderClient {
    TransitFetchResult fetchVehiclePositions();
}
