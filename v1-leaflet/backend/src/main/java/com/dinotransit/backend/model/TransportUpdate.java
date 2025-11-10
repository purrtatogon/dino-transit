package com.dinotransit.backend.model;

// Whatever backend filled this in - same JSON fields so React doesn't fork per mode.
// timestampEpochMs = how old this fix is (I still reuse it even when tagging "cached").
// source = tells the badge whether it came from live API vs sim vs schedule vs stale replay.
public record TransportUpdate(
        String type,
        String dinoName,
        String status,
        Double latitude,
        Double longitude,
        String direction,
        String lineColor,
        long timestampEpochMs,
        String source
) {}