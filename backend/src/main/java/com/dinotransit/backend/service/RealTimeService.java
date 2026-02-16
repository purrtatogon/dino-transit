package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.List;

// this is the "broadcaster"

@Service
public class RealTimeService {

    private final JurassicRailService jurassicRailService;
    private final SimpMessagingTemplate webSocketTemplate;

    public RealTimeService(JurassicRailService jurassicRailService, SimpMessagingTemplate webSocketTemplate) {
        this.jurassicRailService = jurassicRailService;
        this.webSocketTemplate = webSocketTemplate;
    }

    // update every 500ms (which is 0.5 seconds)
    @Scheduled(fixedRate = 500)
    public void broadcastUpdates() {
        // get the whole fleet
        List<TransportUpdate> updates = jurassicRailService.getSimulatedFleet();

        webSocketTemplate.convertAndSend("/topic/transport", updates);
    }
}