'use client';

import dynamic from 'next/dynamic';
import { FieldProvider } from './FieldContext';
import FieldDialog from './FieldDialog';

const Map = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => <div className="h-screen w-full bg-gray-100 flex items-center justify-center">Loading Field Map...</div>
});

const MapWrapper = () => {
    return (
        <FieldProvider>
            <Map />
            <FieldDialog />
        </FieldProvider>
    );
};

export default MapWrapper;
