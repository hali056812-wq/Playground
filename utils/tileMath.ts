
/**
 * Convert Slippy Map Tile (x, y, z) to Lat/Lng Bounding Box
 * @returns [minLng, minLat, maxLng, maxLat]
 */
export function tileToBBox(x: number, y: number, z: number): [number, number, number, number] {
    function tile2long(x: number, z: number) {
        return (x / Math.pow(2, z)) * 360 - 180;
    }
    function tile2lat(y: number, z: number) {
        const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }
    return [
        tile2long(x, z),
        tile2lat(y + 1, z),
        tile2long(x + 1, z),
        tile2lat(y, z),
    ];
}
