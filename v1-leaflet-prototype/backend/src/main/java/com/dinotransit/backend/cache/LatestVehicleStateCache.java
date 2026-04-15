package com.dinotransit.backend.cache;

import com.dinotransit.backend.model.TransportUpdate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class LatestVehicleStateCache {

    public static final class MotionState {
        private double startLatitude;
        private double startLongitude;
        private long transitionStartMs;
        private long transitionDurationMs;
        private double targetLatitude;
        private double targetLongitude;
        private long targetTimestampSec;
        private double lastRenderedLatitude;
        private double lastRenderedLongitude;
        private boolean initialized;

        public double getStartLatitude() {
            return startLatitude;
        }

        public void setStartLatitude(double startLatitude) {
            this.startLatitude = startLatitude;
        }

        public double getStartLongitude() {
            return startLongitude;
        }

        public void setStartLongitude(double startLongitude) {
            this.startLongitude = startLongitude;
        }

        public long getTransitionStartMs() {
            return transitionStartMs;
        }

        public void setTransitionStartMs(long transitionStartMs) {
            this.transitionStartMs = transitionStartMs;
        }

        public long getTransitionDurationMs() {
            return transitionDurationMs;
        }

        public void setTransitionDurationMs(long transitionDurationMs) {
            this.transitionDurationMs = transitionDurationMs;
        }

        public double getTargetLatitude() {
            return targetLatitude;
        }

        public void setTargetLatitude(double targetLatitude) {
            this.targetLatitude = targetLatitude;
        }

        public double getTargetLongitude() {
            return targetLongitude;
        }

        public void setTargetLongitude(double targetLongitude) {
            this.targetLongitude = targetLongitude;
        }

        public long getTargetTimestampSec() {
            return targetTimestampSec;
        }

        public void setTargetTimestampSec(long targetTimestampSec) {
            this.targetTimestampSec = targetTimestampSec;
        }

        public double getLastRenderedLatitude() {
            return lastRenderedLatitude;
        }

        public void setLastRenderedLatitude(double lastRenderedLatitude) {
            this.lastRenderedLatitude = lastRenderedLatitude;
        }

        public double getLastRenderedLongitude() {
            return lastRenderedLongitude;
        }

        public void setLastRenderedLongitude(double lastRenderedLongitude) {
            this.lastRenderedLongitude = lastRenderedLongitude;
        }

        public boolean isInitialized() {
            return initialized;
        }

        public void setInitialized(boolean initialized) {
            this.initialized = initialized;
        }
    }

    public record Point(double latitude, double longitude) {
    }

    private final Map<String, MotionState> motionStates = new ConcurrentHashMap<>();
    private final AtomicReference<List<TransportUpdate>> lastKnownGoodUpdates = new AtomicReference<>(List.of());

    public MotionState motionStateFor(String vehicleKey) {
        return motionStates.computeIfAbsent(vehicleKey, ignored -> new MotionState());
    }

    public List<TransportUpdate> getLastKnownGoodUpdates() {
        return lastKnownGoodUpdates.get();
    }

    public void setLastKnownGoodUpdates(List<TransportUpdate> updates) {
        lastKnownGoodUpdates.set(List.copyOf(updates));
    }
}
