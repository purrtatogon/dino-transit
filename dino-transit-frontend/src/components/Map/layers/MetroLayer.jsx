import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// here I define the icon
const brachioIcon = new L.Icon({
    iconUrl: '/assets/sprites/brachiosaurus_walk_green.gif', 
    iconSize: [64, 64],     // big size
    iconAnchor: [32, 64],   // feet at the bottom
    popupAnchor: [0, -60],
    className: 'pixel-dino'
});

const MetroLayer = ({ data }) => {
    // only show items where type is "Metro"
    const metros = data.filter(d => d.type === 'Metro');

    return (
        <>
            {metros.map((train, idx) => (
                <Marker 
                    key={`metro-${idx}`} 
                    position={[train.latitude, train.longitude]} 
                    icon={brachioIcon}
                >
                    <Popup>
                        <strong>{train.dinoName}</strong><br/>
                        Status: {train.status}
                    </Popup>
                </Marker>
            ))}
        </>
    );
};

export default MetroLayer;