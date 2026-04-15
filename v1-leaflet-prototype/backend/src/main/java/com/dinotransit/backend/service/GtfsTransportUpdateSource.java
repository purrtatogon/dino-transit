package com.dinotransit.backend.service;

import com.dinotransit.backend.gtfs.GtfsStaticLoader;
import com.dinotransit.backend.mapping.VehicleToTransportUpdateMapper;
import com.dinotransit.backend.model.TransportUpdate;
import com.dinotransit.backend.provider.TransitFetchResult;
import com.dinotransit.backend.provider.TransitProviderClient;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GtfsTransportUpdateSource implements TransportUpdateSource {

    private final TransitProviderClient transitProviderClient;
    private final GtfsStaticLoader gtfsStaticLoader;
    private final VehicleToTransportUpdateMapper mapper;

    public GtfsTransportUpdateSource(
            TransitProviderClient transitProviderClient,
            GtfsStaticLoader gtfsStaticLoader,
            VehicleToTransportUpdateMapper mapper
    ) {
        this.transitProviderClient = transitProviderClient;
        this.gtfsStaticLoader = gtfsStaticLoader;
        this.mapper = mapper;
    }

    @Override
    public List<TransportUpdate> getCurrentUpdates() {
        return fetchCurrentUpdates().updates();
    }

    public GtfsMappedFetchResult fetchCurrentUpdates() {
        TransitFetchResult fetchResult = transitProviderClient.fetchVehiclePositions();
        List<TransportUpdate> mappedUpdates = mapper.map(
                fetchResult.snapshots(),
                gtfsStaticLoader.current(),
                fetchResult.dwellingTripIds()
        );
        return new GtfsMappedFetchResult(fetchResult.successful(), mappedUpdates);
    }

    public record GtfsMappedFetchResult(
            boolean fetchSuccessful,
            List<TransportUpdate> updates
    ) {
    }
}
