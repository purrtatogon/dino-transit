package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SimulatorTransportUpdateSource implements TransportUpdateSource {

    private final JurassicRailService jurassicRailService;

    public SimulatorTransportUpdateSource(JurassicRailService jurassicRailService) {
        this.jurassicRailService = jurassicRailService;
    }

    @Override
    public List<TransportUpdate> getCurrentUpdates() {
        return jurassicRailService.getSimulatedFleet();
    }
}
