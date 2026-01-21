'use client';

import ReactMarkdown from 'react-markdown';

interface AnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: string | null;
    fieldName: string;
}

const AnalysisModal = ({ isOpen, onClose, isLoading, result, fieldName }: AnalysisModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[500px] max-h-[80vh] overflow-y-auto transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">AI Analysis: {fieldName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                        <p className="text-gray-600 animate-pulse">Consulting Agronomy AI...</p>
                    </div>
                ) : (
                    <div className="prose prose-green max-w-none text-black">
                        <ReactMarkdown>{result || "No analysis available."}</ReactMarkdown>
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisModal;
