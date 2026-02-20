package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class RealTimeService {

    private final JurassicRailService jurassicRailService;
    private final SimpMessagingTemplate webSocketTemplate;

    public RealTimeService(JurassicRailService jurassicRailService, SimpMessagingTemplate webSocketTemplate) {
        this.jurassicRailService = jurassicRailService;
        this.webSocketTemplate = webSocketTemplate;
    }

    @Scheduled(fixedRate = 500)
    public void broadcastUpdates() {
        List<TransportUpdate> updates = jurassicRailService.getSimulatedFleet();

        webSocketTemplate.convertAndSend("/topic/transport", updates);
    }
}