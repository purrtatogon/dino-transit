import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { Client } from '@stomp/stompjs';
import 'leaflet/dist/leaflet.css';
import MetroLayer from './layers/MetroLayer';
import StationLayer from './layers/StationLayer';
import WipModal from "../ui/WipModal";

const DinoMap = () => {
    const [transportData, setTransportData] = useState([]);
    const [layers, setLayers] = useState({ metro: true, bus: false, train: false, air: false });
    const [activeWip, setActiveWip] = useState(null);

    useEffect(() => {
        const client = new Client({
            brokerURL: 'ws://localhost:8080/ws', 
            connectHeaders: {},
            debug: function (str) {
                console.log(str);
            },
            reconnectDelay: 5000, 
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,

            onConnect: () => {
                console.log("Connected via Native WebSockets!");
                client.subscribe('/topic/transport', (message) => {
                    setTransportData(JSON.parse(message.body));
                });
            },
        });
        client.activate();
        return () => client.deactivate();
    }, []);

    const toggle = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));
    const handleWipClick = (type) => {
        setActiveWip(type);
    };

    return (
        <div style={{ height: "100vh", width: "100%", position: "relative" }}>
            <MapContainer center={[38.722, -9.139]} zoom={13} style={{ height: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="pixel-map-tiles"/>
                <StationLayer />
                {layers.metro && <MetroLayer data={transportData} />}
                
            </MapContainer>

            {activeWip && <WipModal type={activeWip} onClose={() => setActiveWip(null)} />}

            <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button 
                    onClick={() => toggle('metro')} 
                    style={{ fontSize: '24px', cursor: 'pointer', opacity: layers.metro ? 1 : 0.5 }}
                >
                    🦖
                </button>
                <button 
                    onClick={() => handleWipClick('bus')} 
                    style={{ fontSize: '24px', cursor: 'pointer' }}
                >
                    🚌
                </button>
                <button 
                    onClick={() => handleWipClick('train')} 
                    style={{ fontSize: '24px', cursor: 'pointer' }}
                >
                    🛡️
                </button>
                <button 
                    onClick={() => handleWipClick('air')} 
                    style={{ fontSize: '24px', cursor: 'pointer' }}
                >
                    ✈️
                </button>
            </div>
        </div>
    );
};

export default DinoMap;