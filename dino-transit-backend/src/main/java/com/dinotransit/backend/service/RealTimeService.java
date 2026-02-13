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

    // run every 3 seconds!
    @Scheduled(fixedRate = 3000)
    public void broadcastUpdates() {
        TransportUpdate metroUpdate = jurassicRailService.getSimulatedMetro();

        // push the list of updates to the frontend topic
        webSocketTemplate.convertAndSend("/topic/transport", List.of(metroUpdate));
        System.out.println("Broadcasted Metro update: " + metroUpdate);
    }
}