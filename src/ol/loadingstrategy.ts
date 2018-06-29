import { Extent } from './extent';
import { TileCoord } from './tilecoord';
import TileGrid from './tilegrid/TileGrid';

/**
 * @module ol/loadingstrategy
 */


/**
 * Strategy function for loading all features with a single request.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} resolution Resolution.
 * @return {Array.<module:ol/extent~Extent>} Extents.
 * @api
 */
export function all(_extent: Extent, _resolution: number) {
	return [[-Infinity, -Infinity, Infinity, Infinity]] as Extent[];
}


/**
 * Strategy function for loading features based on the view's extent and
 * resolution.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} resolution Resolution.
 * @return {Array.<module:ol/extent~Extent>} Extents.
 * @api
 */
export function bbox(extent: Extent, _resolution: number) {
	return [extent];
}


/**
 * Creates a strategy function for loading features based on a tile grid.
 * @param {module:ol/tilegrid/TileGrid} tileGrid Tile grid.
 * @return {function(module:ol/extent~Extent, number): Array.<module:ol/extent~Extent>} Loading strategy.
 * @api
 */
export function tile(tileGrid: TileGrid) {
	return (
		/**
		 * @param {module:ol/extent~Extent} extent Extent.
		 * @param {number} resolution Resolution.
		 * @return {Array.<module:ol/extent~Extent>} Extents.
		 */
		(extent: Extent, resolution: number) => {
			const z = tileGrid.getZForResolution(resolution);
			const tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);
			/** @type {Array.<module:ol/extent~Extent>} */
			const extents = [];
			/** @type {module:ol/tilecoord~TileCoord} */
			const tileCoord = [z, 0, 0] as TileCoord;
			for (tileCoord[1] = tileRange.minX; tileCoord[1] <= tileRange.maxX; ++tileCoord[1]) {
				for (tileCoord[2] = tileRange.minY; tileCoord[2] <= tileRange.maxY; ++tileCoord[2]) {
					extents.push(tileGrid.getTileCoordExtent(tileCoord));
				}
			}
			return extents;
		}
	);
}
