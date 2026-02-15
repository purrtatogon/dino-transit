package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

// this is the simulator service

@Service
public class JurassicRailService {

    // the GREEN line stations (latitude and longitude)
    private static final double[][] STATIONS = {
            {38.7060, -9.1440}, // Cais do Sodré (Index 0)
            {38.7107, -9.1393}, // Baixa-Chiado
            {38.7200, -9.1340}, // Martim Moniz
            {38.7369, -9.1338}, // Alameda
            {38.7500, -9.1500}, // Campo Grande (Index 4)
    };

    // an inner class to track each individual brachiosaurus
    private static class DinoTrain {
        String id;
        int currentStationIndex; // Which station are we at/leaving?
        double progress = 0.0;   // 0.0 = At Station, 1.0 = At Next Station
        boolean movingForward = true; // True = Cais -> Campo, False = Campo -> Cais
        boolean isStopped = false;    // Are we boarding passengers?
        int stopTimer = 0;            // How many ticks to wait at station

        public DinoTrain(String id, int startIndex, boolean forward) {
            this.id = id;
            this.currentStationIndex = startIndex;
            this.movingForward = forward;
        }
    }

    private final List<DinoTrain> fleet = new ArrayList<>();

    public JurassicRailService() {
        // initialize the fleet
        // Train 1 — Starts at Cais (0), going Up
        fleet.add(new DinoTrain("Metro-01", 0, true));
        // Train 2 — Starts at Alameda (3), going Up
        fleet.add(new DinoTrain("Metro-02", 3, true));
        // Train 3 — Starts at Campo Grande (4), going Down
        fleet.add(new DinoTrain("Metro-03", 4, false));
    }

    public List<TransportUpdate> getSimulatedFleet() {
        List<TransportUpdate> updates = new ArrayList<>();

        for (DinoTrain train : fleet) {
            updateTrainPhysics(train);

            // calculate CURRENT position — interpolation
            double[] pos = calculatePosition(train);

            // determine the STATUS for the sprite swap
            String status = train.isStopped ? "Boarding" : "Moving";

            // if movingForward is TRUE (going East/Right), we do NOT flip (false)
            // if movingForward is FALSE (going West/Left), we DO flip (true)
            boolean shouldFlip = !train.movingForward;

            updates.add(new TransportUpdate(
                    "Metro",
                    train.id,
                    status,
                    pos[0],
                    pos[1],
                    shouldFlip
            ));
        }
        return updates;
    }

    private void updateTrainPhysics(DinoTrain train) {
        // LOGIC — Handle Station Stops
        if (train.isStopped) {
            train.stopTimer--;
            if (train.stopTimer <= 0) {
                train.isStopped = false; // Depart!
            }
            return; // don't move while stopped
        }

        // LOGIC — move along the track
        // Speed — 0.05 means it takes 20 ticks to travel between stations
        // At 500ms per tick, that's 10 seconds per station segment
        train.progress += 0.05;

        // LOGIC — Arrival at next station
        if (train.progress >= 1.0) {
            train.progress = 0.0;
            train.isStopped = true;
            train.stopTimer = 10; // wait 10 ticks (5 seconds) at station

            // Update Station Index
            if (train.movingForward) {
                train.currentStationIndex++;
                // End of line? Switch direction
                if (train.currentStationIndex >= STATIONS.length - 1) {
                    train.movingForward = false;
                }
            } else {
                train.currentStationIndex--;
                // End of line? Switch direction
                if (train.currentStationIndex <= 0) {
                    train.movingForward = true;
                }
            }
        }
    }

    // Math Helper — Linear Interpolation between two stations
    private double[] calculatePosition(DinoTrain train) {
        if (train.isStopped) {
            // Exactly at the station
            return STATIONS[train.currentStationIndex];
        }

        int nextIndex = train.movingForward ? train.currentStationIndex + 1 : train.currentStationIndex - 1;

        double[] start = STATIONS[train.currentStationIndex];
        double[] end = STATIONS[nextIndex];

        // "Lerp" (Linear Interpolation) formula
        double currentLat = start[0] + (end[0] - start[0]) * train.progress;
        double currentLng = start[1] + (end[1] - start[1]) * train.progress;

        return new double[]{currentLat, currentLng};
    }
}