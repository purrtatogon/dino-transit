package com.dinotransit.backend.gtfs;

import java.util.Map;

public record GtfsStaticReferenceData(
        Map<String, String> tripToRoute,
        Map<String, String> routeToLineColor
) {
    public static GtfsStaticReferenceData empty() {
        return new GtfsStaticReferenceData(Map.of(), Map.of());
    }
}
