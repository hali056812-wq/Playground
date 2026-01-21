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
import Draggable from './Draggable';

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
  }, [activeFieldId, map]); // Removed 'fields' to prevent refocusing on every field list update

  return null;
};

const Map = () => {
  const { fields, removeField, triggerAnalysis, clearAllFields, activeFieldId, setActiveFieldId, isLoaded } = useField();
  const [mapLayer, setMapLayer] = useState<'NDVI' | 'NDMI' | 'NDRE' | 'VISUAL'>('NDVI');
  const [baseLayer, setBaseLayer] = useState<'ESRI' | 'SENTINEL'>('ESRI');

  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    });
  }, []);

  // Autofocus on the most recent field ONLY upon initial page load
  useEffect(() => {
    if (isLoaded && fields.length > 0 && !activeFieldId) {
      setActiveFieldId(fields[fields.length - 1].id);
    }
  }, [isLoaded]); // Only run when initial load completes

  return (
    <div className="h-screen w-full relative">
      <MapContainer
        center={[39.8283, -98.5795]} // Neutral Center on Mount
        zoom={4}
        scrollWheelZoom={true}
        closePopupOnClick={false}
        style={{ height: '100%', width: '100%' }}
      >
        {baseLayer === 'ESRI' ? (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='Sentinel-2 &copy; Copernicus'
            url="/api/tiles/{z}/{x}/{y}"
            maxNativeZoom={14} // Sentinel resolution limit
          />
        )}

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

        <SentinelOverlay polygonId={activeFieldId} isVisible={!!activeFieldId} layerType={mapLayer} />
        <MapSearch />
        <MapDraw />
        <MapFocusHandler />

      </MapContainer>

      {/* UI overlays outside MapContainer to avoid Leaflet DOM conflicts */}
      {isLoaded && (
        <Draggable className="absolute top-4 right-4 z-[1000]">
          <div className="bg-white p-3 rounded-lg shadow-xl flex flex-col gap-2 border border-gray-200 min-w-[200px]">
            <label className="font-bold text-xs text-gray-500 uppercase tracking-wider">Analysis Layer</label>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-md">
              <button
                onClick={() => setMapLayer('NDVI')}
                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${mapLayer === 'NDVI' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                🌱 Vegetation
              </button>
              <button
                onClick={() => setMapLayer('NDMI')}
                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${mapLayer === 'NDMI' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                💧 Moisture
              </button>
              <button
                onClick={() => setMapLayer('NDRE')}
                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${mapLayer === 'NDRE' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                ❤️ Health
              </button>
              <button
                onClick={() => setMapLayer('VISUAL')}
                className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${mapLayer === 'VISUAL' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                👁️ Visual
              </button>
            </div>
          </div>
        </Draggable>
      )}

      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 items-end">
        {/* Explorer Mode Toggle */}
        <div className="bg-white p-2 rounded-lg shadow-xl flex flex-col gap-1 border border-gray-200">
          <label className="font-bold text-[10px] text-gray-500 uppercase tracking-wider px-1">Global View</label>
          <div className="flex gap-1 bg-gray-100 p-1 rounded">
            <button
              onClick={() => setBaseLayer('ESRI')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${baseLayer === 'ESRI' ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              Static (Clear)
            </button>
            <button
              onClick={() => setBaseLayer('SENTINEL')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${baseLayer === 'SENTINEL' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              Live (Cloudy)
            </button>
          </div>
        </div>

        <button
          onClick={clearAllFields}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow-lg transition-transform hover:scale-105"
        >
          🚨 Hard Reset Map
        </button>
      </div>
    </div>
  );
};

export default Map;
