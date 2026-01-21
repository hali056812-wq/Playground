'use client';
import { useEffect, useState } from 'react';
import { ImageOverlay, useMap } from 'react-leaflet';
import { useField, Field } from './FieldContext';
import { fetchSentinelImage } from '@/actions/satellite';
import L from 'leaflet';

interface SentinelOverlayProps {
    polygonId?: string;
    isVisible: boolean;
    layerType: 'NDVI' | 'NDMI' | 'NDRE' | 'VISUAL';
}

const SentinelOverlay = ({ polygonId, isVisible, layerType }: SentinelOverlayProps) => {
    const { fields } = useField();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [bounds, setBounds] = useState<[[number, number], [number, number]] | null>(null);
    const map = useMap();

    useEffect(() => {
        // Explicitly clear when disabled or ID missing
        if (!isVisible || !polygonId) {
            setImageUrl(null);
            setBounds(null);
            return;
        }

        const activeField = fields.find(f => f.id === polygonId || f.polygonId === polygonId);
        if (!activeField) {
            setImageUrl(null);
            setBounds(null);
            return;
        }

        let isMounted = true;

        const loadOverlay = async () => {
            // Prevent showing old image while loading new one
            setImageUrl(null);

            const geom = activeField.geometry.type === 'Feature' ? activeField.geometry.geometry : activeField.geometry;
            const coords = geom.coordinates[0];

            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
            coords.forEach((c: [number, number]) => {
                const [lng, lat] = c;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
            });

            const fieldBounds: [[number, number], [number, number]] = [[minLat, minLng], [maxLat, maxLng]];

            if (!isMounted) return;
            setBounds(fieldBounds);

            // Fetch Image
            const url = await fetchSentinelImage(geom, layerType);
            if (url && isMounted) {
                setImageUrl(url);
            }
        };

        loadOverlay();

        return () => { isMounted = false; };
    }, [polygonId, isVisible, fields, map, layerType]);

    if (!isVisible || !imageUrl || !bounds) return null;

    return (
        <ImageOverlay
            url={imageUrl}
            bounds={bounds}
            opacity={0.8}
            interactive={true}
            zIndex={100}
        />
    );
};

export default SentinelOverlay;
