package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;

import java.util.List;

public interface TransportUpdateSource {
    List<TransportUpdate> getCurrentUpdates();
}
