package com.dinotransit.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "transit")
public class TransitDataProperties {

    private String mode = "schedule";
    private long broadcastFixedRateMs = 500L;
    private final Gtfs gtfs = new Gtfs();
    private final MetroLisboa metroLisboa = new MetroLisboa();
    private final Fallback fallback = new Fallback();

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public long getBroadcastFixedRateMs() {
        return broadcastFixedRateMs;
    }

    public void setBroadcastFixedRateMs(long broadcastFixedRateMs) {
        this.broadcastFixedRateMs = broadcastFixedRateMs;
    }

    public Gtfs getGtfs() {
        return gtfs;
    }

    public Fallback getFallback() {
        return fallback;
    }

    public MetroLisboa getMetroLisboa() {
        return metroLisboa;
    }

    public static class Gtfs {
        private boolean enabled = true;
        private String staticPath = "";
        private String vehiclePositionsUrl = "";
        private String tripUpdatesUrl = "";
        private long connectTimeoutMs = 3000L;
        private long readTimeoutMs = 3000L;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getStaticPath() {
            return staticPath;
        }

        public void setStaticPath(String staticPath) {
            this.staticPath = staticPath;
        }

        public String getVehiclePositionsUrl() {
            return vehiclePositionsUrl;
        }

        public void setVehiclePositionsUrl(String vehiclePositionsUrl) {
            this.vehiclePositionsUrl = vehiclePositionsUrl;
        }

        public String getTripUpdatesUrl() {
            return tripUpdatesUrl;
        }

        public void setTripUpdatesUrl(String tripUpdatesUrl) {
            this.tripUpdatesUrl = tripUpdatesUrl;
        }

        public long getConnectTimeoutMs() {
            return connectTimeoutMs;
        }

        public void setConnectTimeoutMs(long connectTimeoutMs) {
            this.connectTimeoutMs = connectTimeoutMs;
        }

        public long getReadTimeoutMs() {
            return readTimeoutMs;
        }

        public void setReadTimeoutMs(long readTimeoutMs) {
            this.readTimeoutMs = readTimeoutMs;
        }
    }

    public static class MetroLisboa {
        private boolean enabled = true;
        private String baseUrl = "https://api.metrolisboa.pt:8243/estadoServicoML/1.0.1";
        private String tokenUrl = "";
        private String accessToken = "";
        private String clientId = "";
        private String clientSecret = "";
        private long timeoutMs = 4000L;
        private int maxVehiclesPerLine = 6;
        private boolean insecureSsl = false;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getBaseUrl() {
            return baseUrl;
        }

        public void setBaseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
        }

        public String getTokenUrl() {
            return tokenUrl;
        }

        public void setTokenUrl(String tokenUrl) {
            this.tokenUrl = tokenUrl;
        }

        public String getAccessToken() {
            return accessToken;
        }

        public void setAccessToken(String accessToken) {
            this.accessToken = accessToken;
        }

        public String getClientId() {
            return clientId;
        }

        public void setClientId(String clientId) {
            this.clientId = clientId;
        }

        public String getClientSecret() {
            return clientSecret;
        }

        public void setClientSecret(String clientSecret) {
            this.clientSecret = clientSecret;
        }

        public long getTimeoutMs() {
            return timeoutMs;
        }

        public void setTimeoutMs(long timeoutMs) {
            this.timeoutMs = timeoutMs;
        }

        public int getMaxVehiclesPerLine() {
            return maxVehiclesPerLine;
        }

        public void setMaxVehiclesPerLine(int maxVehiclesPerLine) {
            this.maxVehiclesPerLine = maxVehiclesPerLine;
        }

        public boolean isInsecureSsl() {
            return insecureSsl;
        }

        public void setInsecureSsl(boolean insecureSsl) {
            this.insecureSsl = insecureSsl;
        }
    }

    public static class Fallback {
        private boolean scheduleEnabled = true;
        private boolean simulatorEnabled = false;
        private boolean publishLastKnownGood = true;

        public boolean isScheduleEnabled() {
            return scheduleEnabled;
        }

        public void setScheduleEnabled(boolean scheduleEnabled) {
            this.scheduleEnabled = scheduleEnabled;
        }

        public boolean isSimulatorEnabled() {
            return simulatorEnabled;
        }

        public void setSimulatorEnabled(boolean simulatorEnabled) {
            this.simulatorEnabled = simulatorEnabled;
        }

        public boolean isPublishLastKnownGood() {
            return publishLastKnownGood;
        }

        public void setPublishLastKnownGood(boolean publishLastKnownGood) {
            this.publishLastKnownGood = publishLastKnownGood;
        }
    }
}
