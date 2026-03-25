/**
 * Real-time payloads: everything ends up as a {@link com.dinotransit.backend.model.TransportUpdate},
 * whatever backend is plugged in.
 *
 * <p>{@link com.dinotransit.backend.service.ConfiguredTransportUpdateSource} picks the mode from
 * {@code transit.mode}. If live stuff fails or comes back empty, I fall through: saved snapshot -> schedule guess -> simulator so the map usually isn't blank.
 *
 * <p>{@link JurassicRailService} is my fake-but-smooth ride for demos. Metro's API ({@link MetroLisboaTransportUpdateSource})
 * only gave me waits and statuses, so I interpolate between stops and sprites jump more - that's expected vs the sim.
 * GTFS-RT ({@link GtfsTransportUpdateSource}) is the path when you actually have vehicle positions + static GTFS wired up.
 *
 * <p>The long version of this story is in the root README ("Project evolution").
 */
package com.dinotransit.backend.service;
