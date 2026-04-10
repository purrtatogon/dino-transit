package com.dinotransit.backend.model;

// Every data source (live API, simulator, schedule) produces the same shape of
// update so the frontend never has to care where the data came from — it just
// renders sprites.  The two fields that make this possible:
//   - timestampEpochMs: lets the frontend know how "fresh" a position is
//   - source:           tells the UI which fallback tier produced this update
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