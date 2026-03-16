package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class JurassicRailService {

    private static final double[][] GREEN_LINE_STATIONS = {
            {38.7602, -9.1661}, {38.7500, -9.1500}, {38.7460, -9.1470}, {38.7420, -9.1440},
            {38.7480, -9.1410}, {38.7420, -9.1330}, {38.7360, -9.1320}, {38.7330, -9.1340},
            {38.7270, -9.1340}, {38.7230, -9.1350}, {38.7200, -9.1340}, {38.7150, -9.1400},
            {38.7100, -9.1390}, {38.7060, -9.1440}
    };

    private static final double[][] RED_LINE_STATIONS = {
            {38.7340, -9.1530}, {38.7340, -9.1450}, {38.7360, -9.1320}, {38.7380, -9.1250},
            {38.7400, -9.1180}, {38.7450, -9.1100}, {38.7520, -9.1070}, {38.7580, -9.1020},
            {38.7672, -9.0992}, {38.7680, -9.1050}, {38.7685, -9.1150}, {38.7690, -9.1290}
    };

    private static final double[][] BLUE_LINE_STATIONS = {
            {38.7522, -9.2241}, {38.7587, -9.2179}, {38.7603, -9.2045}, {38.7622, -9.1969},
            {38.7592, -9.1927}, {38.7531, -9.1894}, {38.7475, -9.1805}, {38.7423, -9.1725},
            {38.7412, -9.1685}, {38.7376, -9.1595}, {38.7340, -9.1530}, {38.7291, -9.1504},
            {38.7259, -9.1500}, {38.7203, -9.1453}, {38.7156, -9.1416}, {38.7100, -9.1390},
            {38.7072, -9.1328}, {38.7137, -9.1221}
    };

    private static final double[][] YELLOW_LINE_STATIONS = {
            {38.7934, -9.1734}, {38.7857, -9.1718}, {38.7795, -9.1596}, {38.7733, -9.1593},
            {38.7675, -9.1558}, {38.7500, -9.1500}, {38.7460, -9.1470}, {38.7420, -9.1440},
            {38.7405, -9.1460}, {38.7340, -9.1450}, {38.7305, -9.1470}, {38.7259, -9.1500},
            {38.7201, -9.1549}
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
                    train.lineColor
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

        train.progress += 0.05;

        if (train.progress >= 1.0) {
            train.progress = 0.0;
            train.isStopped = true;
            train.stopTimer = 10;

            if (train.movingForward) {
                train.currentStationIndex++;
                if (train.currentStationIndex >= train.stations.length - 1) {
                    train.movingForward = false;
                }
            } else {
                train.currentStationIndex--;
                if (train.currentStationIndex <= 0) {
                    train.movingForward = true;
                }
            }
        }
    }

    private double[] calculatePosition(DinoTrain train) {
        if (train.isStopped) {
            return train.stations[train.currentStationIndex];
        }

        int nextIndex = train.movingForward ? train.currentStationIndex + 1 : train.currentStationIndex - 1;
        double[] start = train.stations[train.currentStationIndex];
        double[] end = train.stations[nextIndex];

        double currentLat = start[0] + (end[0] - start[0]) * train.progress;
        double currentLng = start[1] + (end[1] - start[1]) * train.progress;

        return new double[]{currentLat, currentLng};
    }
}
