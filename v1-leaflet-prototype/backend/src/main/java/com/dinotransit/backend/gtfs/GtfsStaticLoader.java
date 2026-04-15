package com.dinotransit.backend.gtfs;

import com.dinotransit.backend.config.TransitDataProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class GtfsStaticLoader {

    private static final Logger logger = LoggerFactory.getLogger(GtfsStaticLoader.class);

    private final TransitDataProperties properties;
    private final AtomicReference<GtfsStaticReferenceData> cachedReferenceData =
            new AtomicReference<>(GtfsStaticReferenceData.empty());

    public GtfsStaticLoader(TransitDataProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void loadAtStartup() {
        refresh();
    }

    public GtfsStaticReferenceData current() {
        return cachedReferenceData.get();
    }

    private void refresh() {
        String basePath = properties.getGtfs().getStaticPath();
        if (basePath == null || basePath.isBlank()) {
            logger.info("GTFS static path is empty; static mapping disabled.");
            cachedReferenceData.set(GtfsStaticReferenceData.empty());
            return;
        }

        Path routesFile = Path.of(basePath, "routes.txt");
        Path tripsFile = Path.of(basePath, "trips.txt");
        if (!Files.exists(routesFile) || !Files.exists(tripsFile)) {
            logger.warn("GTFS static files not found at {} (expected routes.txt and trips.txt)", basePath);
            cachedReferenceData.set(GtfsStaticReferenceData.empty());
            return;
        }

        try {
            Map<String, String> routeToLineColor = loadRouteToLineColor(routesFile);
            Map<String, String> tripToRoute = loadTripToRoute(tripsFile);
            cachedReferenceData.set(new GtfsStaticReferenceData(tripToRoute, routeToLineColor));
            logger.info(
                    "Loaded GTFS static references: routes={}, trips={}",
                    routeToLineColor.size(),
                    tripToRoute.size()
            );
        } catch (IOException exception) {
            logger.warn("Failed to parse GTFS static files: {}", exception.getMessage());
            cachedReferenceData.set(GtfsStaticReferenceData.empty());
        }
    }

    private Map<String, String> loadRouteToLineColor(Path routesFile) throws IOException {
        List<Map<String, String>> rows = readCsvRows(routesFile);
        Map<String, String> routeToLineColor = new HashMap<>();
        for (Map<String, String> row : rows) {
            String routeId = row.getOrDefault("route_id", "");
            if (routeId.isBlank()) {
                continue;
            }
            String routeShortName = row.getOrDefault("route_short_name", "");
            String routeLongName = row.getOrDefault("route_long_name", "");
            String routeColor = row.getOrDefault("route_color", "");
            routeToLineColor.put(routeId, resolveLineColor(routeShortName, routeLongName, routeColor));
        }
        return routeToLineColor;
    }

    private Map<String, String> loadTripToRoute(Path tripsFile) throws IOException {
        List<Map<String, String>> rows = readCsvRows(tripsFile);
        Map<String, String> tripToRoute = new HashMap<>();
        for (Map<String, String> row : rows) {
            String tripId = row.getOrDefault("trip_id", "");
            String routeId = row.getOrDefault("route_id", "");
            if (tripId.isBlank() || routeId.isBlank()) {
                continue;
            }
            tripToRoute.put(tripId, routeId);
        }
        return tripToRoute;
    }

    private List<Map<String, String>> readCsvRows(Path filePath) throws IOException {
        List<String> lines = Files.readAllLines(filePath, StandardCharsets.UTF_8);
        if (lines.isEmpty()) {
            return List.of();
        }

        List<String> headers = parseCsvLine(lines.get(0));
        List<Map<String, String>> rows = new ArrayList<>();

        for (int index = 1; index < lines.size(); index += 1) {
            String line = lines.get(index);
            if (line.isBlank()) {
                continue;
            }

            List<String> values = parseCsvLine(line);
            Map<String, String> row = new LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i += 1) {
                String value = i < values.size() ? values.get(i) : "";
                row.put(headers.get(i), value);
            }
            rows.add(row);
        }
        return rows;
    }

    private List<String> parseCsvLine(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i += 1) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch == ',' && !inQuotes) {
                cells.add(current.toString().trim());
                current.setLength(0);
                continue;
            }

            current.append(ch);
        }

        cells.add(current.toString().trim());
        return cells;
    }

    private String resolveLineColor(String routeShortName, String routeLongName, String routeColor) {
        String colorByCode = normalizeRouteColor(routeColor);
        if (!colorByCode.isBlank()) {
            return colorByCode;
        }

        String merged = (routeShortName + " " + routeLongName).toLowerCase(Locale.ROOT);
        if (merged.contains("verde") || merged.contains("green")) {
            return "green";
        }
        if (merged.contains("vermelha") || merged.contains("red")) {
            return "red";
        }
        if (merged.contains("azul") || merged.contains("blue")) {
            return "blue";
        }
        if (merged.contains("amarela") || merged.contains("yellow")) {
            return "yellow";
        }
        return "";
    }

    private String normalizeRouteColor(String routeColor) {
        String normalized = routeColor == null ? "" : routeColor.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "00843d", "#00843d", "green", "verde" -> "green";
            case "d50032", "#d50032", "ff0000", "#ff0000", "red", "vermelha" -> "red";
            case "0057b8", "#0057b8", "0000ff", "#0000ff", "blue", "azul" -> "blue";
            case "ffd100", "#ffd100", "ffff00", "#ffff00", "yellow", "amarela" -> "yellow";
            default -> "";
        };
    }
}
