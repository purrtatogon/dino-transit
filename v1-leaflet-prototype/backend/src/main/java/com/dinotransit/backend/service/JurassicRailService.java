package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

// The simulator is our "safety net" data source.  It produces smooth, tiny
// position changes every tick, so sprites always look good on the map.
// When the real Metro Lisboa API is down (or returns empty data), the fallback
// chain in ConfiguredTransportUpdateSource routes here so the map is never empty.
//
// The simulator advances trains at a roughly constant speed along each
// inter-station straight segment (same station order as metroLines.js).
// Shorter segments take less wall time than long ones, like a real metro.
// Live API data, by contrast, arrives irregularly and with bigger jumps —
// that's why the frontend keeps teleport-threshold and dead-reckoning logic.
@Service
public class JurassicRailService {

    /**
     * Euclidean distance in lat/lng per broadcast tick — not true metres, but
     * dividing by segment length yields a nearly constant apparent speed on the map.
     * Tuned for ~500ms ticks so a medium segment takes on the order of tens of seconds.
     */
    private static final double DISTANCE_PER_TICK = 4.8e-5;

    // These coordinates MUST match metroLines.js on the frontend exactly,
    // otherwise sprites stop slightly off from the station node markers.
    private static final double[][] GREEN_LINE_STATIONS = {
            {38.7604, -9.16606},  // Telheiras
            {38.7599, -9.15794},  // Campo Grande
            {38.7535, -9.14388},  // Alvalade
            {38.7485, -9.14135},  // Roma
            {38.7426, -9.13381},  // Areeiro
            {38.7373, -9.13409},  // Alameda
            {38.7335, -9.13445},  // Arroios
            {38.7266, -9.13503},  // Anjos
            {38.7222, -9.13531},  // Intendente
            {38.7168, -9.13575},  // Martim Moniz
            {38.7138, -9.13896},  // Rossio
            {38.7107, -9.13909},  // Baixa-Chiado
            {38.7062, -9.14503}   // Cais do Sodré
    };

    private static final double[][] RED_LINE_STATIONS = {
            {38.7348, -9.15423},  // São Sebastião
            {38.7353, -9.14558},  // Saldanha
            {38.7373, -9.13409},  // Alameda
            {38.7392, -9.12366},  // Olaias
            {38.7477, -9.11855},  // Bela Vista
            {38.7553, -9.11414},  // Chelas
            {38.7613, -9.11204},  // Olivais
            {38.7632, -9.10409},  // Cabo Ruivo
            {38.7678, -9.09977},  // Oriente
            {38.7748, -9.10266},  // Moscavide
            {38.7750, -9.11498},  // Encarnação
            {38.7686, -9.12833}   // Aeroporto
    };

    private static final double[][] BLUE_LINE_STATIONS = {
            {38.7522, -9.22414},  // Reboleira
            {38.7584, -9.21917},  // Amadora Este
            {38.7606, -9.20471},  // Alfornelos
            {38.7624, -9.19693},  // Pontinha
            {38.7593, -9.19281},  // Carnide
            {38.7533, -9.18866},  // Colégio Militar/Luz
            {38.7496, -9.17995},  // Alto dos Moinhos
            {38.7485, -9.17243},  // Laranjeiras
            {38.7422, -9.16872},  // Jardim Zoológico
            {38.7377, -9.15845},  // Praça de Espanha
            {38.7348, -9.15423},  // São Sebastião
            {38.7297, -9.15028},  // Parque
            {38.7249, -9.15081},  // Marquês de Pombal
            {38.7201, -9.14582},  // Avenida
            {38.7151, -9.14162},  // Restauradores
            {38.7107, -9.13909},  // Baixa-Chiado
            {38.7072, -9.13335},  // Terreiro do Paço
            {38.7138, -9.12256}   // Santa Apolónia
    };

    private static final double[][] YELLOW_LINE_STATIONS = {
            {38.7932, -9.17322},  // Odivelas
            {38.7858, -9.17215},  // Senhor Roubado
            {38.7799, -9.15999},  // Ameixoeira
            {38.7728, -9.15970},  // Lumiar
            {38.7671, -9.15546},  // Quinta das Conchas
            {38.7599, -9.15794},  // Campo Grande
            {38.7519, -9.15863},  // Cidade Universitária
            {38.7479, -9.14856},  // Entre Campos
            {38.7414, -9.14703},  // Campo Pequeno
            {38.7353, -9.14558},  // Saldanha
            {38.7306, -9.14650},  // Picoas
            {38.7249, -9.15081},  // Marquês de Pombal
            {38.7201, -9.15411}   // Rato
    };

    private static class DinoTrain {
        String id;
        String lineColor;
        double[][] stations;
        int currentStationIndex;
        double progress = 0.0;
        boolean movingForward;
        boolean isStopped = false;
        int stopTimer = 0;

        public DinoTrain(String id, String lineColor, double[][] stations, int startIndex, boolean forward) {
            this.id = id;
            this.lineColor = lineColor;
            this.stations = stations;
            this.currentStationIndex = startIndex;
            this.movingForward = forward;
        }
    }

    private final List<DinoTrain> fleet = new ArrayList<>();

    public JurassicRailService() {
        addLineFleet("green", GREEN_LINE_STATIONS, 6);
        addLineFleet("red", RED_LINE_STATIONS, 6);
        addLineFleet("blue", BLUE_LINE_STATIONS, 6);
        addLineFleet("yellow", YELLOW_LINE_STATIONS, 6);
    }

    private void addLineFleet(String color, double[][] stations, int count) {
        int half = count / 2;
        int lastIdx = stations.length - 1;
        String prefix = "Metro-" + color.substring(0, 1).toUpperCase();
        for (int i = 0; i < half; i++) {
            int idx = Math.min(i * (lastIdx / (half + 1)), lastIdx - 1);
            fleet.add(new DinoTrain(prefix + "-S" + (i + 1), color, stations, idx, true));
        }
        for (int i = 0; i < half; i++) {
            int idx = Math.max(lastIdx - i * (lastIdx / (half + 1)), 1);
            fleet.add(new DinoTrain(prefix + "-N" + (i + 1), color, stations, idx, false));
        }
    }

    public List<TransportUpdate> getSimulatedFleet() {
        List<TransportUpdate> updates = new ArrayList<>();

        for (DinoTrain train : fleet) {
            updateTrainPhysics(train);
            double[] pos = calculatePosition(train);
            String status = train.isStopped ? "Boarding" : "Moving";
            

            int nextIndex = train.movingForward ? train.currentStationIndex + 1 : train.currentStationIndex - 1;
            

            if (nextIndex >= train.stations.length) nextIndex = train.stations.length - 1;
            if (nextIndex < 0) nextIndex = 0;

            double[] startNode = train.stations[train.currentStationIndex];
            double[] endNode = train.stations[nextIndex];
            

            String direction = calculateDirection(startNode, endNode);

            updates.add(new TransportUpdate(
                    "Metro",
                    train.id,
                    status,
                    pos[0],
                    pos[1],
                    direction,
                    train.lineColor,
                    System.currentTimeMillis(),
                    "simulated"
            ));
        }
        return updates;
    }

    private String calculateDirection(double[] start, double[] end) {
        double startLat = start[0];
        double startLng = start[1];
        double endLat = end[0];
        double endLng = end[1];

        if (startLat == endLat && startLng == endLng) return "east";

        // remember: lat is Y, lng is X when you think in map coords
        double dy = endLat - startLat;
        double dx = endLng - startLng;

        double angle = Math.toDegrees(Math.atan2(dy, dx));

        if (angle >= -45 && angle <= 45) {
            return "east";
        } else if (angle > 45 && angle <= 135) {
            return "north";
        } else if (angle < -45 && angle >= -135) {
            return "south";
        } else {
            return "west";
        }
    }

    private void updateTrainPhysics(DinoTrain train) {
        if (train.isStopped) {
            train.stopTimer--;
            if (train.stopTimer <= 0) {
                train.isStopped = false;
            }
            return;
        }

        int nextIndex = train.movingForward ? train.currentStationIndex + 1 : train.currentStationIndex - 1;
        if (nextIndex >= train.stations.length) {
            nextIndex = train.stations.length - 1;
        }
        if (nextIndex < 0) {
            nextIndex = 0;
        }

        double[] start = train.stations[train.currentStationIndex];
        double[] end = train.stations[nextIndex];
        double segmentLength = segmentLength(start, end);
        if (segmentLength < 1e-10) {
            arriveAtNextStation(train);
            return;
        }

        // Constant track speed: same geographic step each tick, longer segments need more ticks.
        train.progress += DISTANCE_PER_TICK / segmentLength;

        while (train.progress >= 1.0) {
            train.progress -= 1.0;
            arriveAtNextStation(train);
            if (train.isStopped) {
                train.progress = 0.0;
                break;
            }
        }
    }

    private static double segmentLength(double[] a, double[] b) {
        double dLat = b[0] - a[0];
        double dLng = b[1] - a[1];
        return Math.hypot(dLat, dLng);
    }

    /**
     * Finish the current leg: dwell at the station we just reached, then advance
     * the station index (or reverse at a terminus).
     */
    private void arriveAtNextStation(DinoTrain train) {
        train.isStopped = true;
        train.stopTimer = 10;

        if (train.movingForward) {
            train.currentStationIndex++;
            if (train.currentStationIndex >= train.stations.length - 1) {
                train.currentStationIndex = train.stations.length - 1;
                train.movingForward = false;
            }
        } else {
            train.currentStationIndex--;
            if (train.currentStationIndex <= 0) {
                train.currentStationIndex = 0;
                train.movingForward = true;
            }
        }
    }

    private double[] calculatePosition(DinoTrain train) {
        if (train.isStopped) {
            return train.stations[train.currentStationIndex];
        }

        int nextIndex = train.movingForward ? train.currentStationIndex + 1 : train.currentStationIndex - 1;
        if (nextIndex >= train.stations.length) {
            nextIndex = train.stations.length - 1;
        }
        if (nextIndex < 0) {
            nextIndex = 0;
        }
        double[] start = train.stations[train.currentStationIndex];
        double[] end = train.stations[nextIndex];

        double currentLat = start[0] + (end[0] - start[0]) * train.progress;
        double currentLng = start[1] + (end[1] - start[1]) * train.progress;

        return new double[]{currentLat, currentLng};
    }
}
