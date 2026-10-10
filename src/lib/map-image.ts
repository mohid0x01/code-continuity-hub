/** Local east/north projection shared by raster imagery and extruded map geometry. */
export function mapImagePlacement(lat: number, lng: number, zoom: number, pixels: number, tile?: { x: number; y: number }) {
  const earthRadius = 6378137;
  const world = 256 * 2 ** zoom;
  const radians = lat * Math.PI / 180;
  const metersPerPixel = 2 * Math.PI * earthRadius * Math.cos(radians) / world;
  const px = (lng + 180) / 360 * world;
  const py = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * world;
  return {
    widthMeters: pixels * metersPerPixel,
    offsetX: tile ? ((tile.x + 0.5) * 256 - px) * metersPerPixel : 0,
    offsetZ: tile ? ((tile.y + 0.5) * 256 - py) * metersPerPixel : 0,
  };
}