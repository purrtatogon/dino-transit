package com.dinotransit.backend.model;

public record TransportUpdate(
        String type,      // "Metro", "Bus", "Train", "Plane"
        String dinoName,  // "Brachiosaurus", "Triceratops", etc.
        String status,    // "Roaring on Schedule"
        Double latitude,
        Double longitude,
        boolean flipImage // so the flip can work dynamically
) {}