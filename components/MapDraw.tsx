'use client';

import { useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useField } from './FieldContext';

// @ts-ignore
(window as any).type = ''; // Fix for some leaflet-draw issues with global types if needed

const MapDraw = () => {
    const map = useMap();
    const drawnItemsRef = useRef(new L.FeatureGroup());
    const { openDialog } = useField();

    useEffect(() => {
        const drawnItems = drawnItemsRef.current;
        map.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: drawnItems,
            },
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#f59e0b', // Amber-500
                        weight: 3,
                    },
                },
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
            },
            position: 'topright',
        });

        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, (e: any) => {
            const layer = e.layer;
            drawnItems.addLayer(layer);

            // Trigger dialog
            openDialog(layer);
        });

        return () => {
            map.removeControl(drawControl);
            map.removeLayer(drawnItems);
        };
    }, [map, openDialog]);

    return null;
};

export default MapDraw;
