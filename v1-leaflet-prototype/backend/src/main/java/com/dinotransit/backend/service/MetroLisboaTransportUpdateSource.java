package com.dinotransit.backend.service;

import com.dinotransit.backend.config.TransitDataProperties;
import com.dinotransit.backend.model.TransportUpdate;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

// The live data source — calls the real Metro de Lisboa API.
//
// Important: this API gives us *wait times at stations*, NOT GPS coordinates
// of trains.  We convert "train X is 3 min from station Y" into a lat/lng
// by interpolating between stations on the line topology.  That's why live
// positions jump more than the simulator's smooth increments — we're
// estimating, not tracking.
//
// When this source returns 0 updates (API down, metro closed, etc.), the
// ConfiguredTransportUpdateSource fallback chain kicks in automatically.
@Service
public class MetroLisboaTransportUpdateSource implements TransportUpdateSource {

    private static final Logger logger = LoggerFactory.getLogger(MetroLisboaTransportUpdateSource.class);
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(\\d+)");

    private static final long DATA_CACHE_TTL_MS = 5_000L;

    private final TransitDataProperties properties;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final AtomicReference<CachedToken> cachedToken = new AtomicReference<>();
    private volatile List<TransportUpdate> cachedUpdates = List.of();
    private volatile long cachedUpdatesTimestamp = 0L;

    public MetroLisboaTransportUpdateSource(TransitDataProperties properties) {
        this.properties = properties;
        this.httpClient = buildHttpClient();
    }

    private HttpClient buildHttpClient() {
        HttpClient.Builder builder = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(properties.getMetroLisboa().getTimeoutMs()));

        if (!properties.getMetroLisboa().isInsecureSsl()) {
            return builder.build();
        }

        try {
            TrustManager[] trustAll = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }
                    }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAll, new SecureRandom());
            logger.warn("METROLISBOA_INSECURE_SSL is enabled. TLS certificate validation is disabled for Metro Lisboa requests.");
            return builder
                    .sslContext(sslContext)
                    .sslParameters(insecureSslParameters())
                    .build();
        } catch (GeneralSecurityException exception) {
            logger.warn("Failed to set insecure SSL mode for Metro Lisboa client: {}", exception.getMessage());
            return builder.build();
        }
    }

    private javax.net.ssl.SSLParameters insecureSslParameters() {
        javax.net.ssl.SSLParameters params = new javax.net.ssl.SSLParameters();
        params.setEndpointIdentificationAlgorithm("");
        return params;
    }

    @Override
    public List<TransportUpdate> getCurrentUpdates() {
        if (!properties.getMetroLisboa().isEnabled()) {
            logger.debug("Metro Lisboa source is disabled");
            return List.of();
        }

        long now = System.currentTimeMillis();
        if (now - cachedUpdatesTimestamp < DATA_CACHE_TTL_MS && !cachedUpdates.isEmpty()) {
            return cachedUpdates;
        }

        String bearerToken = resolveBearerToken();
        if (bearerToken.isBlank()) {
            logger.warn("Metro Lisboa: no bearer token available — skipping");
            return cachedUpdates;
        }

        try {
            logger.debug("Metro Lisboa: fetching station info and wait times…");
            JsonNode stationsNode = getJson("/infoEstacao/todos", bearerToken);
            JsonNode waitTimesNode = getJson("/tempoEspera/Estacao/todos", bearerToken);

            if (stationsNode == null || waitTimesNode == null) {
                logger.warn("Metro Lisboa: one or both API endpoints returned null/error");
                return cachedUpdates;
            }

            Map<String, StationInfo> stations = parseStations(stationsNode);
            List<WaitRecord> waits = parseWaitRecords(waitTimesNode);

            logger.info("Metro Lisboa: parsed {} station(s), {} wait record(s)", stations.size(), waits.size());

            List<TransportUpdate> updates = buildUpdates(stations, waits);
            logger.info("Metro Lisboa: produced {} transport update(s)", updates.size());

            cachedUpdates = updates;
            cachedUpdatesTimestamp = now;
            return updates;
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            logger.warn("Failed to retrieve Metropolitano data: {}", exception.getMessage());
            return cachedUpdates;
        }
    }

    private JsonNode getJson(String path, String token) throws IOException, InterruptedException {
        String url = cleanBaseUrl(properties.getMetroLisboa().getBaseUrl()) + path;
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(properties.getMetroLisboa().getTimeoutMs()))
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            logger.warn("Metropolitano endpoint {} failed with HTTP {}. Body preview: {}",
                    path, response.statusCode(),
                    response.body().substring(0, Math.min(response.body().length(), 300)));
            return null;
        }
        logger.debug("Metropolitano endpoint {} returned HTTP {} ({} chars)",
                path, response.statusCode(), response.body().length());
        return mapper.readTree(response.body());
    }

    private String resolveBearerToken() {
        String explicitToken = properties.getMetroLisboa().getAccessToken();
        if (explicitToken != null && !explicitToken.isBlank()) {
            return explicitToken.trim();
        }

        CachedToken cached = cachedToken.get();
        long nowEpochSec = System.currentTimeMillis() / 1000L;
        if (cached != null && nowEpochSec < cached.expiresAtEpochSec() - 30) {
            return cached.token();
        }

        return fetchAccessTokenWithClientCredentials();
    }

    private String fetchAccessTokenWithClientCredentials() {
        String tokenUrl = properties.getMetroLisboa().getTokenUrl();
        String clientId = properties.getMetroLisboa().getClientId();
        String clientSecret = properties.getMetroLisboa().getClientSecret();
        if (isBlank(tokenUrl) || isBlank(clientId) || isBlank(clientSecret)) {
            logger.warn("Metropolitano OAuth config missing. Set METROLISBOA_TOKEN_URL, METROLISBOA_CLIENT_ID and METROLISBOA_CLIENT_SECRET.");
            return "";
        }

        try {
            String body = "grant_type=" + URLEncoder.encode("client_credentials", StandardCharsets.UTF_8);
            String credentials = Base64.getEncoder()
                    .encodeToString((clientId + ":" + clientSecret).getBytes(StandardCharsets.UTF_8));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tokenUrl))
                    .timeout(Duration.ofMillis(properties.getMetroLisboa().getTimeoutMs()))
                    .header("Authorization", "Basic " + credentials)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("Metropolitano token request failed with HTTP {}", response.statusCode());
                return "";
            }

            JsonNode json = mapper.readTree(response.body());
            String accessToken = textByKeys(json, "access_token", "accessToken", "token");
            long expiresIn = longByKeys(json, "expires_in", "expiresIn");
            if (isBlank(accessToken)) {
                logger.warn("Metropolitano token response did not include access_token");
                return "";
            }

            long nowSec = System.currentTimeMillis() / 1000L;
            long ttl = expiresIn > 0 ? expiresIn : 3600L;
            cachedToken.set(new CachedToken(accessToken, nowSec + ttl));
            logger.info("Metro Lisboa: OAuth token acquired (expires in {}s)", ttl);
            return accessToken;
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            logger.warn("Metropolitano token request failed: {}", exception.getMessage());
            return "";
        }
    }

    private Map<String, StationInfo> parseStations(JsonNode root) {
        List<JsonNode> rows = collectResposta(root);
        Map<String, StationInfo> stations = new HashMap<>();

        for (JsonNode row : rows) {
            String stationId = firstNonBlank(
                    textByKeys(row, "stop_id", "idEstacao", "id_estacao", "id", "codigo")
            );
            String stationName = firstNonBlank(
                    textByKeys(row, "stop_name", "nome", "estacao", "nomeEstacao", "name")
            );
            Double lat = doubleByKeys(row, "stop_lat", "latitude", "lat", "gps_lat");
            Double lng = doubleByKeys(row, "stop_lon", "longitude", "lon", "lng", "gps_lon");

            if (lat == null || lng == null) {
                continue;
            }

            List<String> lineColors = parseLinhaField(
                    textByKeys(row, "linha", "line")
            );

            StationInfo info = new StationInfo(stationId, stationName, lat, lng, lineColors);
            if (!isBlank(stationId)) {
                stations.put(normalize(stationId), info);
            }
            if (!isBlank(stationName)) {
                stations.put(normalize(stationName), info);
            }
        }
        return stations;
    }

    private List<WaitRecord> parseWaitRecords(JsonNode root) {
        List<JsonNode> rows = collectResposta(root);
        List<WaitRecord> records = new ArrayList<>();

        for (JsonNode row : rows) {
            String stationRef = firstNonBlank(
                    textByKeys(row, "stop_id", "estacao", "nomeEstacao", "station", "idEstacao")
            );
            String lineRef = firstNonBlank(
                    textByKeys(row, "linha", "line", "linhaCor", "lineColor")
            );
            String destination = firstNonBlank(
                    textByKeys(row, "destino", "destination", "sentido")
            );
            Integer waitSeconds = intByKeys(row,
                    "tempoChegada1", "tempoEspera", "tempo", "minutos", "espera");

            if (isBlank(stationRef) || waitSeconds == null) {
                continue;
            }

            String lineColor = normalizeLineColor(lineRef);
            records.add(new WaitRecord(stationRef, lineColor, destination, Math.max(waitSeconds, 0)));
        }

        return records;
    }

    private List<TransportUpdate> buildUpdates(Map<String, StationInfo> stations, List<WaitRecord> waits) {
        List<WaitRecord> resolved = new ArrayList<>();
        for (WaitRecord wait : waits) {
            String lineColor = wait.lineColor();
            if (lineColor.isBlank()) {
                StationInfo station = findStation(stations, wait.stationRef());
                if (station != null && !station.lineColors().isEmpty()) {
                    lineColor = station.lineColors().get(0);
                }
            }
            if (lineColor.isBlank()) {
                continue;
            }
            resolved.add(new WaitRecord(wait.stationRef(), lineColor, wait.destination(), wait.waitSeconds()));
        }

        Map<String, WaitRecord> byStationLine = new HashMap<>();
        for (WaitRecord wait : resolved) {
            String key = normalize(wait.stationRef()) + "|" + wait.lineColor();
            WaitRecord existing = byStationLine.get(key);
            if (existing == null || wait.waitSeconds() < existing.waitSeconds()) {
                byStationLine.put(key, wait);
            }
        }

        Map<String, List<WaitRecord>> byLine = new HashMap<>();
        for (WaitRecord wait : byStationLine.values()) {
            byLine.computeIfAbsent(wait.lineColor(), ignored -> new ArrayList<>()).add(wait);
        }

        List<TransportUpdate> updates = new ArrayList<>();
        int maxPerLine = Math.max(1, properties.getMetroLisboa().getMaxVehiclesPerLine());
        for (Map.Entry<String, List<WaitRecord>> entry : byLine.entrySet()) {
            String lineColor = entry.getKey();
            List<WaitRecord> lineWaits = entry.getValue();
            lineWaits.sort(Comparator.comparingInt(WaitRecord::waitSeconds));

            int limit = Math.min(maxPerLine, lineWaits.size());

            for (int i = 0; i < limit; i += 1) {
                WaitRecord wait = lineWaits.get(i);
                StationInfo station = findStation(stations, wait.stationRef());
                if (station == null) {
                    continue;
                }

                // directionFromDestination gives us which terminus the train
                // is heading toward — needed for forward/backward on the topology.
                String destDirection = directionFromDestination(wait.lineColor(), wait.destination());
                String status = wait.waitSeconds() <= BOARDING_THRESHOLD_SECONDS ? "Boarding" : "Moving";

                double lat = station.latitude();
                double lng = station.longitude();
                // Start with destination-based direction, then override with
                // geometry if interpolation succeeds.
                String direction = destDirection;

                InterpolationResult interp = interpolateTrainPosition(
                        lineColor, destDirection, wait.stationRef(), wait.waitSeconds(), stations);
                if (interp != null) {
                    lat = interp.lat();
                    lng = interp.lng();
                    direction = interp.geometryDirection();
                }

                // Build a stable dinoName from station + direction so React
                // doesn't remount the SpriteMarker when the API's sort order
                // shuffles.  Old approach used a counter-based rank which
                // changed every time wait times reordered.
                String stationTag = normalize(wait.stationRef())
                        .replaceAll("[^a-z0-9]+", "");
                String dinoName = "Metro-"
                        + lineColor.substring(0, 1).toUpperCase(Locale.ROOT)
                        + "-" + stationTag + "-" + direction;

                updates.add(new TransportUpdate(
                        "Metro",
                        dinoName,
                        status,
                        lat,
                        lng,
                        direction,
                        lineColor,
                        System.currentTimeMillis(),
                        "live"
                ));
            }
        }

        return updates;
    }

    private StationInfo findStation(Map<String, StationInfo> stations, String stationRef) {
        StationInfo byId = stations.get(normalize(stationRef));
        if (byId != null) {
            return byId;
        }
        return stations.values().stream()
                .filter(station -> !isBlank(station.stationName()))
                .filter(station -> normalize(station.stationName()).contains(normalize(stationRef)))
                .findFirst()
                .orElse(null);
    }

    // ── Line topologies (ordered from "start" to "end" of each line) ──
    // Forward direction = south for green/yellow, east for blue/red

    private static final Map<String, List<String>> LINE_TOPOLOGY = Map.of(
            "green", List.of(
                    "Telheiras", "Campo Grande", "Alvalade", "Roma", "Areeiro",
                    "Alameda", "Arroios", "Anjos", "Intendente", "Martim Moniz",
                    "Rossio", "Baixa-Chiado", "Cais do Sodré"),
            "yellow", List.of(
                    "Odivelas", "Senhor Roubado", "Ameixoeira", "Lumiar",
                    "Quinta das Conchas", "Campo Grande", "Cidade Universitária",
                    "Entre Campos", "Campo Pequeno", "Saldanha", "Picoas",
                    "Marquês de Pombal", "Rato"),
            "blue", List.of(
                    "Reboleira", "Amadora Este", "Alfornelos", "Pontinha",
                    "Carnide", "Colégio Militar/Luz", "Alto dos Moinhos", "Laranjeiras",
                    "Jardim Zoológico", "Praça de Espanha", "São Sebastião",
                    "Parque", "Marquês de Pombal", "Avenida", "Restauradores",
                    "Baixa-Chiado", "Terreiro do Paço", "Santa Apolónia"),
            "red", List.of(
                    "São Sebastião", "Saldanha", "Alameda", "Olaias",
                    "Bela Vista", "Chelas", "Olivais", "Cabo Ruivo",
                    "Oriente", "Moscavide", "Encarnação", "Aeroporto")
    );

    private static final Map<String, String> LINE_FORWARD_DIRECTION = Map.of(
            "green", "south",
            "yellow", "south",
            "blue", "east",
            "red", "east"
    );

    /** Approximate seconds a train takes to travel between two adjacent stations */
    private static final double INTER_STATION_SECONDS = 90.0;

    /** Below this threshold the train is considered "at the station" */
    private static final int BOARDING_THRESHOLD_SECONDS = 30;

    private static final Map<String, String> DESTINO_DIRECTION = Map.ofEntries(
            Map.entry("50", "north"),
            Map.entry("54", "south"),
            Map.entry("48", "north"),
            Map.entry("43", "south"),
            Map.entry("45", "south"),
            Map.entry("42", "west"),
            Map.entry("33", "east"),
            Map.entry("38", "east"),
            Map.entry("60", "west")
    );

    private static final Map<String, String> LINE_DEFAULT_DIRECTION = Map.of(
            "green", "south",
            "yellow", "south",
            "blue", "east",
            "red", "east"
    );

    private String directionFromDestination(String lineColor, String destination) {
        String mapped = DESTINO_DIRECTION.get(destination);
        if (mapped != null) {
            return mapped;
        }
        String lineDefault = LINE_DEFAULT_DIRECTION.get(lineColor);
        return lineDefault != null ? lineDefault : "east";
    }

    // Result of interpolating a train position: virtual lat/lng and a compass
    // direction derived from the actual topology segment geometry, so the
    // frontend sprite faces the same way as the track polyline.
    private record InterpolationResult(double lat, double lng, String geometryDirection) {}

    /**
     * Calculate a virtual position between two stations based on seconds-until-arrival.
     * Returns position + geometry-derived compass direction, or null if we can't resolve the topology.
     */
    private InterpolationResult interpolateTrainPosition(
            String lineColor, String direction, String stationRef,
            int waitSeconds, Map<String, StationInfo> stations
    ) {
        List<String> topology = LINE_TOPOLOGY.get(lineColor);
        if (topology == null) return null;

        int arrivalIdx = findTopologyIndex(topology, stationRef, stations);
        if (arrivalIdx < 0) return null;

        // Train is at/near the station → snap to station coords
        if (waitSeconds <= BOARDING_THRESHOLD_SECONDS) {
            StationInfo arrStation = resolveTopologyStation(topology.get(arrivalIdx), stations);
            return arrStation != null
                    ? new InterpolationResult(
                            arrStation.latitude(), arrStation.longitude(), direction)
                    : null;
        }

        // How many station-hops back is the train?
        String forwardDir = LINE_FORWARD_DIRECTION.getOrDefault(lineColor, "east");
        boolean isForward = direction.equals(forwardDir);

        double stationsBack = waitSeconds / INTER_STATION_SECONDS;
        double trainIdx = isForward
                ? arrivalIdx - stationsBack
                : arrivalIdx + stationsBack;

        trainIdx = Math.max(0, Math.min(topology.size() - 1.0, trainIdx));

        int segStart = (int) Math.floor(trainIdx);
        int segEnd = Math.min(segStart + 1, topology.size() - 1);
        double t = trainIdx - segStart;

        StationInfo fromSt = resolveTopologyStation(topology.get(segStart), stations);
        StationInfo toSt = resolveTopologyStation(topology.get(segEnd), stations);

        if (fromSt == null || toSt == null) return null;

        double lat = fromSt.latitude() + t * (toSt.latitude() - fromSt.latitude());
        double lng = fromSt.longitude() + t * (toSt.longitude() - fromSt.longitude());

        // Derive compass direction from the actual segment geometry so the
        // frontend sprite faces the same way as the polyline on the map.
        String geoDir = compassFromSegment(
                fromSt.latitude(), fromSt.longitude(),
                toSt.latitude(), toSt.longitude(),
                direction);

        return new InterpolationResult(lat, lng, geoDir);
    }

    /**
     * Convert a topology segment (from→to) into a cardinal compass direction.
     * Falls back to {@code fallback} when the two stations are effectively the same point.
     */
    private static String compassFromSegment(
            double fromLat, double fromLng,
            double toLat, double toLng,
            String fallback
    ) {
        double dLat = toLat - fromLat;
        double dLng = toLng - fromLng;
        if (Math.abs(dLat) < 1e-7 && Math.abs(dLng) < 1e-7) {
            return fallback;
        }
        if (Math.abs(dLat) >= Math.abs(dLng)) {
            return dLat > 0 ? "north" : "south";
        }
        return dLng > 0 ? "east" : "west";
    }

    /** Find the index of a station in the topology by name, using flexible matching. */
    private int findTopologyIndex(List<String> topology, String stationRef, Map<String, StationInfo> stations) {
        String normRef = normalize(stationRef);

        for (int i = 0; i < topology.size(); i++) {
            if (normalize(topology.get(i)).equals(normRef)) return i;
        }

        StationInfo info = findStation(stations, stationRef);
        if (info != null) {
            String normName = normalize(info.stationName());
            for (int i = 0; i < topology.size(); i++) {
                if (normalize(topology.get(i)).equals(normName)) return i;
            }
            for (int i = 0; i < topology.size(); i++) {
                String normTopo = normalize(topology.get(i));
                if (normName.contains(normTopo) || normTopo.contains(normName)) return i;
            }
        }

        return -1;
    }

    /** Look up a topology station name in the stations map. */
    private StationInfo resolveTopologyStation(String topoName, Map<String, StationInfo> stations) {
        StationInfo direct = stations.get(normalize(topoName));
        if (direct != null) return direct;
        return findStation(stations, topoName);
    }

    private String normalizeLineColor(String raw) {
        String value = normalize(raw);
        if (value.contains("verde") || value.contains("green")) return "green";
        if (value.contains("vermelha") || value.contains("red")) return "red";
        if (value.contains("azul") || value.contains("blue")) return "blue";
        if (value.contains("amarela") || value.contains("yellow")) return "yellow";
        if (value.equals("v")) return "green";
        if (value.equals("r")) return "red";
        if (value.equals("a")) return "blue";
        if (value.equals("am")) return "yellow";
        return "";
    }

    private List<JsonNode> collectResposta(JsonNode root) {
        if (root == null || root.isNull()) {
            return List.of();
        }
        JsonNode resposta = root.get("resposta");
        if (resposta != null && resposta.isArray()) {
            List<JsonNode> items = new ArrayList<>();
            for (JsonNode item : resposta) {
                if (item.isObject()) {
                    items.add(item);
                }
            }
            return items;
        }
        return collectObjects(root);
    }

    private List<JsonNode> collectObjects(JsonNode node) {
        List<JsonNode> objects = new ArrayList<>();
        if (node == null || node.isNull()) {
            return objects;
        }

        if (node.isObject()) {
            objects.add(node);
            node.fields().forEachRemaining(entry -> objects.addAll(collectObjects(entry.getValue())));
            return objects;
        }

        if (node.isArray()) {
            for (JsonNode child : node) {
                objects.addAll(collectObjects(child));
            }
        }
        return objects;
    }

    private List<String> parseLinhaField(String raw) {
        if (isBlank(raw)) {
            return List.of();
        }
        String stripped = raw.replace("[", "").replace("]", "");
        List<String> colors = new ArrayList<>();
        for (String part : stripped.split(",")) {
            String color = normalizeLineColor(part.trim());
            if (!color.isBlank()) {
                colors.add(color);
            }
        }
        return colors;
    }

    private String textByKeys(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode child = node.get(key);
            if (child != null && !child.isNull()) {
                String value = child.asText("").trim();
                if (!value.isBlank()) {
                    return value;
                }
            }
        }
        return "";
    }

    private Double doubleByKeys(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode child = node.get(key);
            if (child != null && !child.isNull()) {
                if (child.isNumber()) {
                    return child.asDouble();
                }
                try {
                    return Double.parseDouble(child.asText(""));
                } catch (NumberFormatException ignored) {
                    // keep trying
                }
            }
        }
        return null;
    }

    private Integer intByKeys(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode child = node.get(key);
            if (child == null || child.isNull()) {
                continue;
            }
            if (child.isNumber()) {
                return child.asInt();
            }
            Matcher matcher = NUMBER_PATTERN.matcher(child.asText(""));
            if (matcher.find()) {
                return Integer.parseInt(matcher.group(1));
            }
        }
        return null;
    }

    private long longByKeys(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode child = node.get(key);
            if (child != null && !child.isNull()) {
                if (child.isNumber()) {
                    return child.asLong();
                }
                try {
                    return Long.parseLong(child.asText(""));
                } catch (NumberFormatException ignored) {
                    // keep trying
                }
            }
        }
        return -1L;
    }

    private String cleanBaseUrl(String baseUrl) {
        if (baseUrl == null) {
            return "";
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private String firstNonBlank(String value) {
        return value == null ? "" : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private record CachedToken(String token, long expiresAtEpochSec) {
    }

    private record StationInfo(
            String stationId,
            String stationName,
            double latitude,
            double longitude,
            List<String> lineColors
    ) {
    }

    private record WaitRecord(
            String stationRef,
            String lineColor,
            String destination,
            int waitSeconds
    ) {
    }
}
