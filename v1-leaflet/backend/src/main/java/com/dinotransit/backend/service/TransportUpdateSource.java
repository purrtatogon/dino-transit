package com.dinotransit.backend.service;

import com.dinotransit.backend.model.TransportUpdate;

import java.util.List;

/** Supplies the list of trains the broadcaster should send — see implementations in this package. */
public interface TransportUpdateSource {
    List<TransportUpdate> getCurrentUpdates();
}
