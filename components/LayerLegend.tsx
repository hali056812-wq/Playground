'use client';

import React from 'react';

interface LayerLegendProps {
    layerType: 'NDVI' | 'NDMI' | 'NDRE' | 'VISUAL' | 'RADAR' | 'THERMAL';
}

const LayerLegend = ({ layerType }: LayerLegendProps) => {
    const renderLegendContent = () => {
        switch (layerType) {
            case 'NDVI':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#16a34a]"></div>
                            <span className="text-xs text-gray-700 font-medium">High Health / Dense Foliage</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#fbbf24]"></div>
                            <span className="text-xs text-gray-700 font-medium">Moderate / Sparse Growth</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#dc2626]"></div>
                            <span className="text-xs text-gray-700 font-medium">Bare Soil / Low Health</span>
                        </div>
                    </div>
                );
            case 'NDRE':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#15803d]"></div>
                            <span className="text-xs text-gray-700 font-medium">Strong Chlorophyll Content</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#fcd34d]"></div>
                            <span className="text-xs text-gray-700 font-medium">Light Chlorophyll / Early Stress</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#ef4444]"></div>
                            <span className="text-xs text-gray-700 font-medium">High Stress / Deficiency</span>
                        </div>
                    </div>
                );
            case 'NDMI':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#1d4ed8]"></div>
                            <span className="text-xs text-gray-700 font-medium">High Moisture / Waterlogged</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#93c5fd]"></div>
                            <span className="text-xs text-gray-700 font-medium">Ideal Canopy Moisture</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-[#92400e]"></div>
                            <span className="text-xs text-gray-700 font-medium">Dry / Water Stress</span>
                        </div>
                    </div>
                );
            case 'RADAR':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-green-500"></div>
                            <span className="text-xs text-gray-700 font-medium">Biomass (Leaves & Stalks)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-red-500"></div>
                            <span className="text-xs text-gray-700 font-medium">Surface Roughness (Soil/Rock)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-500"></div>
                            <span className="text-xs text-gray-700 font-medium">Structural Ratio / Lodging</span>
                        </div>
                    </div>
                );
            case 'THERMAL':
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-red-600"></div>
                            <span className="text-xs text-gray-700 font-medium">Hot (37°C+) / High Stress</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-yellow-400"></div>
                            <span className="text-xs text-gray-700 font-medium">Warm / Normal Sunlight</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-500"></div>
                            <span className="text-xs text-gray-700 font-medium">Cool (7°C) / High Transpiration</span>
                        </div>
                    </div>
                );
            case 'VISUAL':
                return (
                    <div className="flex flex-col items-center py-2">
                        <span className="text-xs text-gray-500 italic">"True Color" - Views the field as seen by the human eye.</span>
                    </div>
                );
            default:
                return null;
        }
    };

    const getTitle = () => {
        switch (layerType) {
            case 'NDVI': return '🌱 Vegetation Index (NDVI)';
            case 'NDMI': return '💧 Moisture Index (NDMI)';
            case 'NDRE': return '❤️ Health Index (NDRE)';
            case 'RADAR': return '📡 Structural Analysis (Radar)';
            case 'THERMAL': return '🌡️ Water Stress (Thermal)';
            case 'VISUAL': return '👁️ Visual Reference';
            default: return 'Layer Legend';
        }
    };

    const getDescription = () => {
        switch (layerType) {
            case 'NDVI': return 'Measures canopy greenness and density.';
            case 'NDMI': return 'Tracks vegetation water content levels.';
            case 'NDRE': return 'Best for mid-to-late season health.';
            case 'RADAR': return 'Sees through clouds via structural signal.';
            case 'THERMAL': return 'Detects "Crop Fever" via surface temp.';
            default: return '';
        }
    };

    return (
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-gray-200 min-w-[220px]">
            <div className="mb-3">
                <h4 className="font-bold text-sm text-gray-900">{getTitle()}</h4>
                {getDescription() && <p className="text-[10px] text-gray-500 font-medium">{getDescription()}</p>}
            </div>

            <div className="border-t border-gray-100 pt-3">
                {renderLegendContent()}
            </div>

            <div className="mt-4 pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Sentinel Insight</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-bold">DRAGGABLE</span>
            </div>
        </div>
    );
};

export default LayerLegend;
