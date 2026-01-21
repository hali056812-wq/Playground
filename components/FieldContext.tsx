'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';


import { analyzeField } from '@/actions/analyzeField';

export interface Field {
    id: string;
    name: string;
    cropType: string;
    plantingDate: string;
    area: number; // in acres or sq meters
    geometry: any; // GeoJSON or similar
    center?: any; // LatLng
    polygonId?: string; // Agromonitoring Polygon ID
}

interface AnalysisState {
    isOpen: boolean;
    isLoading: boolean;
    result: string | null;
    fieldName: string;
}

interface FieldContextType {
    fields: Field[];
    addField: (field: Field) => Promise<void>;
    removeField: (id: string) => void;
    isDialogOpen: boolean;
    openDialog: (layer: any) => void;
    closeDialog: () => void;
    tempLayer: any | null;
    isLoaded: boolean;
    // Analysis
    analysisState: AnalysisState;
    triggerAnalysis: (field: Field) => Promise<void>;
    closeAnalysis: () => void;
    clearAllFields: () => void;
    activeFieldId: string | undefined;
    setActiveFieldId: (id: string | undefined) => void;
}

const FieldContext = createContext<FieldContextType | undefined>(undefined);

export const FieldProvider = ({ children }: { children: ReactNode }) => {
    const [fields, setFields] = useState<Field[]>([]);
    const [activeFieldId, setActiveFieldId] = useState<string | undefined>(undefined);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [tempLayer, setTempLayer] = useState<any | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Analysis State
    const [analysisState, setAnalysisState] = useState<AnalysisState>({
        isOpen: false,
        isLoading: false,
        result: null,
        fieldName: ''
    });

    // Load from Local Storage on Mount
    useEffect(() => {
        const saved = localStorage.getItem('satellite_fields');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setFields(parsed);
                }
            } catch (e) {
                console.error("Failed to parse fields", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to Local Storage when fields change (only after initial load)
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('satellite_fields', JSON.stringify(fields));
        }
    }, [fields, isLoaded]);

    const addField = async (field: Field) => {
        setFields((prev) => {
            if (prev.find(f => f.id === field.id)) return prev;
            return [...prev, field];
        });
    };

    const removeField = (id: string) => {
        setFields((prev) => prev.filter((f) => f.id !== id));
    };

    const clearAllFields = () => {
        if (confirm("Are you sure you want to delete ALL fields and reset the map?")) {
            setFields([]);
            localStorage.removeItem('satellite_fields');
            window.location.reload(); // Force reload to clear all layer states
        }
    };

    const openDialog = (layer: any) => {
        setTempLayer(layer);
        setIsDialogOpen(true);
    };

    const closeDialog = () => {
        setIsDialogOpen(false);
        setTempLayer(null);
    };

    // Analysis Logic
    const triggerAnalysis = async (field: Field) => {
        setAnalysisState({
            isOpen: true,
            isLoading: true,
            result: null,
            fieldName: field.name
        });

        try {
            const result = await analyzeField(field);
            setAnalysisState(prev => ({ ...prev, isLoading: false, result }));
        } catch (error) {
            console.error("Analysis failed", error);
            setAnalysisState(prev => ({
                ...prev,
                isLoading: false,
                result: "Analysis failed. Please try again."
            }));
        }
    };

    const closeAnalysis = () => {
        setAnalysisState(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <FieldContext.Provider value={{
            fields, addField, removeField, isDialogOpen, openDialog, closeDialog, tempLayer, isLoaded,
            analysisState, triggerAnalysis, closeAnalysis, clearAllFields,
            activeFieldId, setActiveFieldId
        }}>
            {children}
        </FieldContext.Provider>
    );
};

export const useField = () => {
    const context = useContext(FieldContext);
    if (context === undefined) {
        throw new Error('useField must be used within a FieldProvider');
    }
    return context;
};
