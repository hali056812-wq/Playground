'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    result: string | null;
    fieldName: string;
    history: { date: string; ndvi: number }[] | null;
}

const AnalysisModal = ({ isOpen, onClose, isLoading, result, fieldName, history }: AnalysisModalProps) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[800px] max-h-[90vh] overflow-y-auto transform transition-all scale-100 flex flex-col gap-6">

                {/* Header */}
                <div className="flex justify-between items-center border-b pb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Field Analysis: {fieldName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-600 border-t-transparent"></div>
                        <p className="text-lg text-gray-600 animate-pulse font-medium">Analyzing Satellite Data...</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Section 1: Growth Chart (Visual First) */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                                <span>📈</span> 6-Month Growth Trends (NDVI)
                            </h3>
                            {isMounted && history && history.length > 0 ? (
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={history} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 12 }}
                                                tickMargin={10}
                                                tickFormatter={(value) => {
                                                    const date = new Date(value);
                                                    return `${date.getMonth() + 1}/${date.getDate()}`;
                                                }}
                                            />
                                            <YAxis
                                                domain={[0, 1]}
                                                tick={{ fontSize: 12 }}
                                                label={{ value: 'Health Index', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="ndvi"
                                                stroke="#16a34a"
                                                strokeWidth={3}
                                                dot={{ fill: '#16a34a', r: 4 }}
                                                activeDot={{ r: 8 }}
                                                animationDuration={1500}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[200px] flex items-center justify-center text-gray-500 italic bg-gray-100/50 rounded-lg">
                                    {history === null ? "Loading historical data..." : "No historical health data available for this area yet."}
                                </div>
                            )}
                        </div>

                        {/* Section 2: AI Analysis */}
                        <div className="bg-green-50/50 p-6 rounded-xl border border-green-100">
                            <h3 className="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                                <span>🤖</span> Agronomist Insights
                            </h3>
                            <div className="prose prose-green max-w-none text-gray-800 leading-relaxed">
                                <ReactMarkdown>{result || "Analysis complete."}</ReactMarkdown>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-4 border-t flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-transform hover:scale-105 shadow-lg">
                        Close Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisModal;
