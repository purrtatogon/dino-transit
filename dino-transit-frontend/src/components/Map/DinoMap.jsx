import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client'; // import this for compatibility!
import 'leaflet/dist/leaflet.css';
import MetroLayer from './layers/MetroLayer';

const DinoMap = () => {
    const [transportData, setTransportData] = useState([]);
    
    // WIP Layer Toggles
    const [layers, setLayers] = useState({ metro: true, bus: false, train: false, air: false });

    useEffect(() => {
        // websockets connection
        const client = new Client({
            webSocketFactory: () => new SockJS('http://localhost:8080/ws'), // Use SockJS factory
            onConnect: () => {
                console.log("Connected to Velociraptor-Socket!");
                client.subscribe('/topic/transport', (message) => {
                    setTransportData(JSON.parse(message.body));
                });
            },
        });
        client.activate();
        return () => client.deactivate();
    }, []);

    const toggle = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

    return (
        <div style={{ height: "100vh", width: "100%", position: "relative" }}>
            <MapContainer center={[38.722, -9.139]} zoom={13} style={{ height: "100%" }}>
                {/* PIXELATED MAP TILES */}
                <TileLayer 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                    className="pixel-map-tiles"
                />
                
                {/* LAYERS */}
                {layers.metro && <MetroLayer data={transportData} />}
                
            </MapContainer>

            {/* FLOATING CONTROLS */}
            <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => toggle('metro')} style={{ fontSize: '24px', cursor: 'pointer', opacity: layers.metro ? 1 : 0.5 }}>🦖</button>
                <button title="WIP" style={{ fontSize: '24px', opacity: 0.3, cursor: 'not-allowed' }}>🚌</button>
                <button title="WIP" style={{ fontSize: '24px', opacity: 0.3, cursor: 'not-allowed' }}>🛡️</button>
                <button title="WIP" style={{ fontSize: '24px', opacity: 0.3, cursor: 'not-allowed' }}>✈️</button>
            </div>
        </div>
    );
};

export default DinoMap;