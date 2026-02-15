import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const createDinoIcon = (status, isFlipped) => {
    const filename = status === 'Boarding' 
        ? 'brachiosaurus_idle_green.png' 
        : 'brachiosaurus_walk_green.gif';

    // Logic — We apply the flip class to the INNER image, not the outer div
    const flipClass = isFlipped ? 'dino-flipped' : '';

    return L.divIcon({
        // the wrapper (leaflet moves this)
        className: 'dino-wrapper', 
        
        // the inner content (we flip this)
        html: `
            <img 
                src="/assets/sprites/${filename}" 
                class="pixel-dino ${flipClass}" 
                style="width: 100%; height: 100%;"
            />
        `,
        
        iconSize: [64, 64],
        iconAnchor: [32, 64],
        popupAnchor: [0, -60]
    });
};

const MetroLayer = ({ data }) => {
    const metros = data.filter(d => d.type === 'Metro');

    return (
        <>
            {metros.map((train) => {
                const icon = createDinoIcon(train.status, train.flipImage);

                return (
                    <Marker 
                        key={train.dinoName} 
                        position={[train.latitude, train.longitude]} 
                        icon={icon}
                    >
                        <Popup>
                            <strong>{train.dinoName}</strong><br/>
                            Status: {train.status}
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
};

export default MetroLayer;