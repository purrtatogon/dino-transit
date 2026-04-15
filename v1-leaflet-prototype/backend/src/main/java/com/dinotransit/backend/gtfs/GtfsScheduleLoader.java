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
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class GtfsScheduleLoader {

    private static final Logger logger = LoggerFactory.getLogger(GtfsScheduleLoader.class);

    private final TransitDataProperties properties;
    private final AtomicReference<GtfsScheduleData> cachedScheduleData =
            new AtomicReference<>(GtfsScheduleData.empty());

    public GtfsScheduleLoader(TransitDataProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void loadAtStartup() {
        refresh();
    }

    public GtfsScheduleData current() {
        return cachedScheduleData.get();
    }

    private void refresh() {
        String basePath = properties.getGtfs().getStaticPath();
        if (basePath == null || basePath.isBlank()) {
            cachedScheduleData.set(GtfsScheduleData.empty());
            return;
        }

        Path tripsFile = Path.of(basePath, "trips.txt");
        Path stopsFile = Path.of(basePath, "stops.txt");
        Path stopTimesFile = Path.of(basePath, "stop_times.txt");
        if (!Files.exists(tripsFile) || !Files.exists(stopsFile) || !Files.exists(stopTimesFile)) {
            logger.warn("GTFS schedule files missing in {}. Need trips.txt, stops.txt, stop_times.txt", basePath);
            cachedScheduleData.set(GtfsScheduleData.empty());
            return;
        }

        try {
            Map<String, String> tripToRoute = loadTripToRoute(tripsFile);
            Map<String, StopCoord> stopCoords = loadStopCoords(stopsFile);
            Map<String, List<RawStopTime>> tripStopTimes = loadTripStopTimes(stopTimesFile);

            List<GtfsScheduleData.TripSchedule> trips = new ArrayList<>();
            for (Map.Entry<String, List<RawStopTime>> entry : tripStopTimes.entrySet()) {
                String tripId = entry.getKey();
                String routeId = tripToRoute.getOrDefault(tripId, "");
                if (routeId.isBlank()) {
                    continue;
                }

                List<RawStopTime> rawStops = entry.getValue();
                rawStops.sort(Comparator.comparingInt(RawStopTime::sequence));

                List<GtfsScheduleData.StopSchedule> mappedStops = new ArrayList<>();
                for (RawStopTime raw : rawStops) {
                    StopCoord coord = stopCoords.get(raw.stopId());
                    if (coord == null) {
                        continue;
                    }
                    mappedStops.add(new GtfsScheduleData.StopSchedule(
                            raw.stopId(),
                            coord.latitude(),
                            coord.longitude(),
                            raw.arrivalSeconds(),
                            raw.departureSeconds(),
                            raw.sequence()
                    ));
                }

                if (mappedStops.size() < 2) {
                    continue;
                }

                trips.add(new GtfsScheduleData.TripSchedule(tripId, routeId, mappedStops));
            }

            cachedScheduleData.set(new GtfsScheduleData(trips));
            logger.info("Loaded GTFS schedule trips: {}", trips.size());
        } catch (IOException exception) {
            logger.warn("Failed to load GTFS schedule data: {}", exception.getMessage());
            cachedScheduleData.set(GtfsScheduleData.empty());
        }
    }

    private Map<String, String> loadTripToRoute(Path tripsFile) throws IOException {
        List<Map<String, String>> rows = readCsvRows(tripsFile);
        Map<String, String> tripToRoute = new HashMap<>();
        for (Map<String, String> row : rows) {
            String tripId = row.getOrDefault("trip_id", "");
            String routeId = row.getOrDefault("route_id", "");
            if (!tripId.isBlank() && !routeId.isBlank()) {
                tripToRoute.put(tripId, routeId);
            }
        }
        return tripToRoute;
    }

    private Map<String, StopCoord> loadStopCoords(Path stopsFile) throws IOException {
        List<Map<String, String>> rows = readCsvRows(stopsFile);
        Map<String, StopCoord> stopCoords = new HashMap<>();
        for (Map<String, String> row : rows) {
            String stopId = row.getOrDefault("stop_id", "");
            if (stopId.isBlank()) {
                continue;
            }

            try {
                double lat = Double.parseDouble(row.getOrDefault("stop_lat", ""));
                double lng = Double.parseDouble(row.getOrDefault("stop_lon", ""));
                stopCoords.put(stopId, new StopCoord(lat, lng));
            } catch (NumberFormatException ignored) {
                // ignore malformed stop rows
            }
        }
        return stopCoords;
    }

    private Map<String, List<RawStopTime>> loadTripStopTimes(Path stopTimesFile) throws IOException {
        List<Map<String, String>> rows = readCsvRows(stopTimesFile);
        Map<String, List<RawStopTime>> tripStopTimes = new HashMap<>();
        for (Map<String, String> row : rows) {
            String tripId = row.getOrDefault("trip_id", "");
            String stopId = row.getOrDefault("stop_id", "");
            String arrivalText = row.getOrDefault("arrival_time", "");
            String departureText = row.getOrDefault("departure_time", "");
            String sequenceText = row.getOrDefault("stop_sequence", "");

            if (tripId.isBlank() || stopId.isBlank() || sequenceText.isBlank()) {
                continue;
            }

            int arrivalSeconds = parseGtfsTime(arrivalText);
            int departureSeconds = parseGtfsTime(departureText);
            int sequence;
            try {
                sequence = Integer.parseInt(sequenceText);
            } catch (NumberFormatException exception) {
                continue;
            }

            if (arrivalSeconds < 0 && departureSeconds < 0) {
                continue;
            }
            if (arrivalSeconds < 0) {
                arrivalSeconds = departureSeconds;
            }
            if (departureSeconds < 0) {
                departureSeconds = arrivalSeconds;
            }

            tripStopTimes
                    .computeIfAbsent(tripId, ignored -> new ArrayList<>())
                    .add(new RawStopTime(stopId, arrivalSeconds, departureSeconds, sequence));
        }
        return tripStopTimes;
    }

    private int parseGtfsTime(String hhmmss) {
        if (hhmmss == null || hhmmss.isBlank()) {
            return -1;
        }
        String[] parts = hhmmss.split(":");
        if (parts.length != 3) {
            return -1;
        }
        try {
            int hour = Integer.parseInt(parts[0]);
            int minute = Integer.parseInt(parts[1]);
            int second = Integer.parseInt(parts[2]);
            return hour * 3600 + minute * 60 + second;
        } catch (NumberFormatException exception) {
            return -1;
        }
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

    private record StopCoord(double latitude, double longitude) {
    }

    private record RawStopTime(
            String stopId,
            int arrivalSeconds,
            int departureSeconds,
            int sequence
    ) {
    }
}
