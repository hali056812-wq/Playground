'use client';

import { useMap } from 'react-leaflet';
import { useEffect, useState, useRef, useCallback } from 'react';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import debounce from 'lodash.debounce';

const MapSearch = () => {
    const map = useMap();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);
    const providerRef = useRef(new OpenStreetMapProvider());
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounced Search for Autocomplete
    const debouncedSearch = useCallback(
        debounce(async (searchTerm: string) => {
            if (!searchTerm || searchTerm.length < 3) return;

            // Don't search if it looks like coordinates
            if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(searchTerm)) return;

            try {
                if (providerRef.current) {
                    const searchResults = await providerRef.current.search({ query: searchTerm });
                    // Guard against unmounted component
                    setResults(searchResults ? searchResults.slice(0, 5) : []);
                    setShowResults(true);
                }
            } catch (e) {
                console.error("Search failed", e);
            }
        }, 500),
        []
    );

    useEffect(() => {
        debouncedSearch(query);
        return () => debouncedSearch.cancel(); // Cleanup
    }, [query, debouncedSearch]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (result: any) => {
        setQuery(result.label); // Update input to full name
        map.flyTo([result.y, result.x], 15, { duration: 1.5 });
        setShowResults(false);
    };

    const handleSmartSubmit = async () => {
        // 1. Check for Coordinates (Smart Regex)
        // Supports: "33.5, -115.5" or "33.5 -115.5"
        const coordRegex = /^(-?\d+(\.\d+)?)[,\s]\s*(-?\d+(\.\d+)?)$/;
        const match = query.match(coordRegex);

        if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[3]);
            if (!isNaN(lat) && !isNaN(lng)) {
                map.flyTo([lat, lng], 15, { duration: 1.5 });
                setShowResults(false);
                return;
            }
        }

        // 2. Fallback to First Address Result
        if (results.length > 0) {
            handleSelect(results[0]);
        } else {
            // Force a quick search if no results yet (e.g. pasted text)
            if (providerRef.current) {
                const searchResults = await providerRef.current.search({ query });
                if (searchResults.length > 0) {
                    handleSelect(searchResults[0]);
                }
            }
        }
    };

    return (
        <div ref={containerRef} className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-4">
            <div className="relative group">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSmartSubmit();
                    }}
                    placeholder="Search address or 'Lat, Lng'..."
                    className="w-full pl-5 pr-14 py-3.5 rounded-2xl shadow-2xl border-2 border-white/60 focus:border-blue-500 outline-none text-gray-800 bg-white/90 backdrop-blur-md transition-all text-lg font-medium placeholder:text-gray-400 focus:shadow-blue-500/20"
                />

                {/* Smart Icon */}
                <button
                    onClick={handleSmartSubmit}
                    className="absolute right-3 top-2.5 p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors"
                    title="Search"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </button>

                {/* Autocomplete Dropdown */}
                {showResults && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md rounded-xl shadow-xl overflow-hidden border border-gray-100 z-[1001] animate-in fade-in slide-in-from-top-2 duration-200">
                        {results.map((result, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleSelect(result)}
                                className="px-5 py-3 hover:bg-blue-50 cursor-pointer text-gray-700 text-sm flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                            >
                                <span className="p-1.5 bg-gray-100 rounded-full text-gray-500">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </span>
                                <span className="truncate flex-1">{result.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Hint (Optional, fades out) */}
            <div className="text-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <span className="text-[10px] font-bold text-gray-600 bg-white/80 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm">
                    💁 Hint: Try "33.5, -115.5"
                </span>
            </div>
        </div>
    );
};

export default MapSearch;
