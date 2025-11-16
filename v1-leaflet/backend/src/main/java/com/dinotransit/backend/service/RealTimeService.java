package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;
import com.dinotransit.backend.config.TransitDataProperties;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Pulls updates on a timer and STOMP-sends them to {@code /topic/transport} as JSON.
 */
@Service
public class RealTimeService {

    private final TransportUpdateSource transportUpdateSource;
    private final SimpMessagingTemplate webSocketTemplate;
    private final TransitDataProperties properties;

    public RealTimeService(
            TransportUpdateSource transportUpdateSource,
            SimpMessagingTemplate webSocketTemplate,
            TransitDataProperties properties
    ) {
        this.transportUpdateSource = transportUpdateSource;
        this.webSocketTemplate = webSocketTemplate;
        this.properties = properties;
    }

    @Scheduled(fixedRateString = "#{@transitDataProperties.broadcastFixedRateMs}")
    public void broadcastUpdates() {
        List<TransportUpdate> updates = transportUpdateSource.getCurrentUpdates();

        if (updates.isEmpty() && !properties.getFallback().isPublishLastKnownGood()) {
            return;
        }

        webSocketTemplate.convertAndSend("/topic/transport", updates);
    }
}