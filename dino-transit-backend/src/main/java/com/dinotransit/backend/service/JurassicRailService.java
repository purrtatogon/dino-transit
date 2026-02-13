package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.stereotype.Service;

// this is the simulator service

@Service
public class JurassicRailService {

    // hardcoded path for the GREEN brachio (Cais do Sodré -> Campo Grande)
    private static final double[][] GREEN_LINE_PATH = {
            {38.7060, -9.1440}, // Stop 1
            {38.7100, -9.1390}, // Stop 2
            {38.7200, -9.1340}, // Stop 3
            {38.7360, -9.1320}, // Stop 4
            {38.7500, -9.1500}  // Stop 5
    };

    private int currentIndex = 0;
    private boolean movingForward = true;

    public TransportUpdate getSimulatedMetro() {
        // move the index
        if (movingForward) {
            currentIndex++;
            if (currentIndex >= GREEN_LINE_PATH.length - 1) movingForward = false;
        } else {
            currentIndex--;
            if (currentIndex <= 0) movingForward = true;
        }

        return new TransportUpdate(
                "Metro",
                "Brachiosaurus",
                "Roaring on Schedule",
                GREEN_LINE_PATH[currentIndex][0],
                GREEN_LINE_PATH[currentIndex][1]
        );
    }
}