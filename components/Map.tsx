'use client';

import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import MapSearch from './MapSearch';
import MapDraw from './MapDraw';
import { useField, Field } from './FieldContext';
import SentinelOverlay from './SentinelOverlay';
import AnalysisModal from './AnalysisModal'; // We can trigger validation from here too? 
// Actually AnalysisModal is controlled by FieldDialog logic currently?
// Let's modify FieldDialog to be the analysis controller OR move analysis state to Context.
// For now, let's just trigger the 'window.analyze_ID' if we want to keep it simple, 
// OR better: use the analyze function directly if we import it.
import { analyzeField } from '@/actions/analyzeField';

// Helper to auto-center on the last field when loaded
const MapFocusHandler = () => {
  const map = useMap();
  const { fields, activeFieldId } = useField();

  useEffect(() => {
    if (!activeFieldId) return;

    const activeField = fields.find(f => f.id === activeFieldId);
    if (activeField && activeField.center) {
      map.flyTo([activeField.center.lat, activeField.center.lng], 15, { duration: 1.5 });
    }
  }, [activeFieldId, fields, map]);

  return null;
};

const Map = () => {
  const { fields, removeField, triggerAnalysis, clearAllFields, activeFieldId, setActiveFieldId, isLoaded } = useField();

  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);

  return (
    <div className="h-screen w-full relative">
      <MapContainer
        center={[39.8283, -98.5795]} // Neutral Center on Mount
        zoom={4}
        scrollWheelZoom={true}
        closePopupOnClick={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        {fields.map((field) => (
          <GeoJSON
            key={field.id}
            data={field.geometry}
            style={() => ({
              color: field.id === activeFieldId ? '#00ff00' : '#ff7800',
              weight: field.id === activeFieldId ? 3 : 2,
              opacity: 0.65,
              fillOpacity: 0.2
            })}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e as any);
                setActiveFieldId(field.id);
              }
            }}
          >
            <Popup>
              <div className="font-sans min-w-[200px]">
                <h3 className="font-bold text-lg text-black">{field.name}</h3>
                <p className="text-gray-700">Crop: {field.cropType}</p>
                <p className="text-gray-700">Date: {field.plantingDate}</p>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => triggerAnalysis(field)}
                    className="flex-1 font-bold py-2 px-2 rounded text-sm transition-colors bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  >
                    ✨ Analyze
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete field "${field.name}"?`)) {
                        removeField(field.id);
                        if (activeFieldId === field.id) setActiveFieldId(undefined);
                      }
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded text-sm transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </Popup>
          </GeoJSON>
        ))}

        <SentinelOverlay polygonId={activeFieldId} isVisible={!!activeFieldId} />
        <MapSearch />
        <MapDraw />
        <MapFocusHandler />

        <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2">
          <button
            onClick={clearAllFields}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-lg transition-transform hover:scale-105"
          >
            🚨 Hard Reset Map
          </button>
        </div>
      </MapContainer>
    </div>
  );
};

export default Map;
