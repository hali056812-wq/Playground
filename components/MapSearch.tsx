'use client';

import { useMap } from 'react-leaflet';
import { useEffect, useState, useRef } from 'react';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';

const MapSearch = () => {
    const map = useMap();
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const providerRef = useRef(new OpenStreetMapProvider());
    const containerRef = useRef<HTMLDivElement>(null);

    // Load History
    useEffect(() => {
        const saved = localStorage.getItem('map_search_history');
        if (saved) {
            try {
                setHistory(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load search history", e);
            }
        }
    }, []);

    // Save History
    const saveToHistory = (term: string) => {
        if (!term.trim()) return;
        const newHistory = [term, ...history.filter(h => h !== term)].slice(0, 5);
        setHistory(newHistory);
        localStorage.setItem('map_search_history', JSON.stringify(newHistory));
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = async (searchTerm: string) => {
        setQuery(searchTerm);
        setShowHistory(false);

        const results = await providerRef.current.search({ query: searchTerm });
        if (results && results.length > 0) {
            const result = results[0];
            map.flyTo([result.y, result.x], 15, { duration: 1.5 });
            saveToHistory(searchTerm);
        }
    };

    return (
        <div ref={containerRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        if (e.target.value.length > 0) setShowHistory(false);
                    }}
                    onFocus={() => {
                        if (query.length === 0) setShowHistory(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch(query);
                    }}
                    placeholder="Search location..."
                    className="w-full px-4 py-3 rounded-xl shadow-2xl border-2 border-white/50 focus:border-blue-500 outline-none text-black bg-white/95 backdrop-blur-md transition-all text-lg"
                />

                {/* Search Icon / Button */}
                <button
                    onClick={() => handleSearch(query)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-blue-500"
                >
                    🔍
                </button>

                {/* History Dropdown */}
                {showHistory && history.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl overflow-hidden border border-gray-100 z-[1001]">
                        <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase bg-gray-50 border-b border-gray-100">
                            Recent Searches
                        </div>
                        {history.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSearch(item)}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-gray-700 text-sm flex items-center gap-2 transition-colors border-b border-gray-50 last:border-0"
                            >
                                <span className="text-gray-400 text-[10px]">🕒</span>
                                {item}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapSearch;

