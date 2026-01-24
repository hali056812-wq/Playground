'use client';

import { useField } from './FieldContext';
import { useState } from 'react';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import AnalysisModal from './AnalysisModal';
import { analyzeField } from '@/actions/analyzeField';

const FieldDialog = () => {
    const { isDialogOpen, closeDialog, addField, tempLayer, analysisState, closeAnalysis } = useField();
    const [name, setName] = useState('');
    const [cropType, setCropType] = useState('Corn');
    const [plantingDate, setPlantingDate] = useState('');

    // If Analysis Modal is open (controlled by Context), show it
    if (analysisState.isOpen) {
        return (
            <AnalysisModal
                isOpen={analysisState.isOpen}
                onClose={closeAnalysis}
                isLoading={analysisState.isLoading}
                result={analysisState.result}
                fieldName={analysisState.fieldName}
                history={analysisState.history}
            />
        );
    }

    // Otherwise show the Add Field Dialog
    if (!isDialogOpen) return null;

    const normalizeLongitude = (lon: number) => {
        return ((lon + 180) % 360 + 360) % 360 - 180;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempLayer) return;

        // Helper to get raw center
        const rawCenter = tempLayer.getBounds ? tempLayer.getBounds().getCenter() :
            (tempLayer.getLatLng ? tempLayer.getLatLng() : null);

        const rawGeoJSON = tempLayer.toGeoJSON();

        // Fix: Normalize coordinates to handle map wrapping (e.g. -464 -> -104)
        const normalizedGeoJSON = {
            ...rawGeoJSON,
            geometry: {
                ...rawGeoJSON.geometry,
                coordinates: rawGeoJSON.geometry.type === 'Polygon'
                    ? rawGeoJSON.geometry.coordinates.map((ring: any[]) =>
                        ring.map((coord: number[]) => [normalizeLongitude(coord[0]), coord[1]])
                    )
                    : rawGeoJSON.geometry.coordinates
            }
        };

        const newField = {
            id: Date.now().toString(),
            name,
            cropType,
            plantingDate,
            center: rawCenter ? { lat: rawCenter.lat, lng: normalizeLongitude(rawCenter.lng) } : null,
            area: 0,
            geometry: normalizedGeoJSON,
        };

        addField(newField);

        // Window hack removed: Map.tsx now uses Context trigger.

        if (tempLayer) {
            tempLayer.remove();
        }

        // Reset and close
        setName('');
        setCropType('Corn');
        setPlantingDate('');
        closeDialog();
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-96 transform transition-all scale-100">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Add Field Details</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-black"
                            placeholder="e.g. North Pasture"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Crop Type</label>
                        <div className="relative">
                            <select
                                value={cropType}
                                onChange={(e) => setCropType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none appearance-none bg-white text-black"
                            >
                                <option value="Corn">Corn</option>
                                <option value="Soybeans">Soybeans</option>
                                <option value="Wheat">Wheat</option>
                                <option value="Cotton">Cotton</option>
                                <option value="Other">Other</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Planting Date</label>
                        <input
                            type="date"
                            value={plantingDate}
                            onChange={(e) => setPlantingDate(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-black"
                        />
                    </div>

                    <div className="flex justify-between items-center mt-6">
                        <button
                            type="button"
                            onClick={(e) => {
                                // Rate Land Potential Mode
                                setName(name || "Unnamed Field");
                                setCropType('None');
                                setPlantingDate('Unknown');
                                // Trigger submit programmatically or just call handler
                                // We need to bypass the form validation for plantingDate if it's empty
                                const fakeEvent = { preventDefault: () => { } } as React.FormEvent;

                                // Direct Field Construction (Bypassing validation states)
                                if (!tempLayer) return;
                                const rawCenter = tempLayer.getBounds ? tempLayer.getBounds().getCenter() : (tempLayer.getLatLng ? tempLayer.getLatLng() : null);
                                const rawGeoJSON = tempLayer.toGeoJSON();
                                const normalizedGeoJSON = {
                                    ...rawGeoJSON,
                                    geometry: {
                                        ...rawGeoJSON.geometry,
                                        coordinates: rawGeoJSON.geometry.type === 'Polygon'
                                            ? rawGeoJSON.geometry.coordinates.map((ring: any[]) => ring.map((coord: number[]) => [normalizeLongitude(coord[0]), coord[1]]))
                                            : rawGeoJSON.geometry.coordinates
                                    }
                                };
                                const newField = {
                                    id: Date.now().toString(),
                                    name: name || "Land Analysis",
                                    cropType: "None",
                                    plantingDate: "Unknown",
                                    center: rawCenter ? { lat: rawCenter.lat, lng: normalizeLongitude(rawCenter.lng) } : null,
                                    area: 0,
                                    geometry: normalizedGeoJSON,
                                };
                                addField(newField);
                                if (tempLayer) tempLayer.remove();
                                setName(''); setCropType('Corn'); setPlantingDate('');
                                closeDialog();
                            }}
                            className="text-sm text-green-700 underline hover:text-green-800 font-medium"
                        >
                            Rate Land Potential Only
                        </button>

                        <div className="flex space-x-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (tempLayer) tempLayer.remove();
                                    closeDialog();
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg transition-all"
                            >
                                Save Field
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FieldDialog;
