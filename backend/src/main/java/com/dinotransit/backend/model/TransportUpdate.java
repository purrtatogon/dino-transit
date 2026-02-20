package com.dinotransit.backend.model;

public record TransportUpdate(
        String type,
        String dinoName,
        String status,
        Double latitude,
        Double longitude,
        String direction,
        String lineColor
) {}