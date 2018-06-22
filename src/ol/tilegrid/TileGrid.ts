/**
 * @module ol/tilegrid/TileGrid
 */
import { isSorted, linearFindNearest } from '../array';
import { assert } from '../asserts';
import { Coordinate } from '../coordinate';
import { createOrUpdate, Extent, getTopLeft } from '../extent';
import { clamp } from '../math';
import { Size, toSize } from '../size';
import { createOrUpdate as createOrUpdateTileCoord, TileCoord } from '../tilecoord';
import TileRange, { createOrUpdate as createOrUpdateTileRange } from '../TileRange';
import { DEFAULT_TILE_SIZE } from './common';


/**
 * @private
 * @type {module:ol/tilecoord~TileCoord}
 */
const tmpTileCoord = [0, 0, 0] as TileCoord;

/**
 * @typedef {Object} Options
 * @property {module:ol/extent~Extent} [extent] Extent for the tile grid. No tiles outside this
 * extent will be requested by {@link module:ol/source/Tile} sources. When no `origin` or
 * `origins` are configured, the `origin` will be set to the top-left corner of the extent.
 * @property {number} [minZoom=0] Minimum zoom.
 * @property {module:ol/coordinate~Coordinate} [origin] The tile grid origin, i.e. where the `x`
 * and `y` axes meet (`[z, 0, 0]`). Tile coordinates increase left to right and upwards. If not
 * specified, `extent` or `origins` must be provided.
 * @property {Array.<module:ol/coordinate~Coordinate>} [origins] Tile grid origins, i.e. where
 * the `x` and `y` axes meet (`[z, 0, 0]`), for each zoom level. If given, the array length
 * should match the length of the `resolutions` array, i.e. each resolution can have a different
 * origin. Tile coordinates increase left to right and upwards. If not specified, `extent` or
 * `origin` must be provided.
 * @property {!Array.<number>} resolutions Resolutions. The array index of each resolution needs
 * to match the zoom level. This means that even if a `minZoom` is configured, the resolutions
 * array will have a length of `maxZoom + 1`.
 * @property {Array.<module:ol/size~Size>} [sizes] Sizes.
 * @property {number|module:ol/size~Size} [tileSize] Tile size.
 * Default is `[256, 256]`.
 * @property {Array.<module:ol/size~Size>} [tileSizes] Tile sizes. If given, the array length
 * should match the length of the `resolutions` array, i.e. each resolution can have a different
 * tile size.
 */

export interface Options {
	extent: Extent;
	minZoom: number;
	origin: Coordinate;
	origins: Coordinate[];
	resolutions: number[];
	sizes: Size[];
	tileSize: Size;
	tileSizes: Size[];
}

/**
 * @classdesc
 * Base class for setting the grid pattern for sources accessing tiled-image
 * servers.
 *
 * @constructor
 * @param {module:ol/tilegrid/TileGrid~Options} options Tile grid options.
 * @struct
 * @api
 */
export default class TileGrid {
	public maxZoom: number;
	public minZoom: number;
	private resolutions: number[];
	private zoomFactor: number | undefined;
	private origin: Coordinate | null;
	private origins: Coordinate[] | null;
	private tileSizes: Size[] | null;
	private tileSize: number | Size | null;
	private extent: Extent | null;
	private fullTileRanges: TileRange[] | null;
	private tmpSize: Size;
	constructor(options: Partial<Options>) {
		/**
		 * @protected
		 * @type {number}
		 */
		this.minZoom = options.minZoom !== undefined ? options.minZoom : 0;

		/**
		 * @private
		 * @type {!Array.<number>}
		 */
		this.resolutions = options.resolutions!;
		assert(isSorted(this.resolutions, (a, b) => {
			return (b - a) as 0 | 1 | -1;
		}, true), 17); // `resolutions` must be sorted in descending order


		// check if we've got a consistent zoom factor and origin
		let zoomFactor;
		if (!options.origins) {
			for (let i = 0, ii = this.resolutions.length - 1; i < ii; ++i) {
				if (!zoomFactor) {
					zoomFactor = this.resolutions[i] / this.resolutions[i + 1];
				} else {
					if (this.resolutions[i] / this.resolutions[i + 1] !== zoomFactor) {
						zoomFactor = undefined;
						break;
					}
				}
			}
		}


		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.zoomFactor = zoomFactor;


		/**
		 * @protected
		 * @type {number}
		 */
		this.maxZoom = this.resolutions.length - 1;

		/**
		 * @private
		 * @type {module:ol/coordinate~Coordinate}
		 */
		this.origin = options.origin !== undefined ? options.origin : null;

		/**
		 * @private
		 * @type {Array.<module:ol/coordinate~Coordinate>}
		 */
		this.origins = null;
		if (options.origins !== undefined) {
			this.origins = options.origins;
			assert(this.origins.length === this.resolutions.length,
				20); // Number of `origins` and `resolutions` must be equal
		}

		const extent = options.extent;

		if (extent !== undefined &&
			!this.origin && !this.origins) {
			this.origin = getTopLeft(extent);
		}

		assert(
			(!this.origin && this.origins) || (this.origin && !this.origins),
			18); // Either `origin` or `origins` must be configured, never both

		/**
		 * @private
		 * @type {Array.<number|module:ol/size~Size>}
		 */
		this.tileSizes = null;
		if (options.tileSizes !== undefined) {
			this.tileSizes = options.tileSizes;
			assert(this.tileSizes.length === this.resolutions.length,
				19); // Number of `tileSizes` and `resolutions` must be equal
		}

		/**
		 * @private
		 * @type {number|module:ol/size~Size}
		 */
		this.tileSize = options.tileSize !== undefined ?
			options.tileSize :
			!this.tileSizes ? DEFAULT_TILE_SIZE : null;
		assert(
			(!this.tileSize && this.tileSizes) ||
			(this.tileSize && !this.tileSizes),
			22); // Either `tileSize` or `tileSizes` must be configured, never both

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.extent = extent !== undefined ? extent : null;


		/**
		 * @private
		 * @type {Array.<module:ol/TileRange>}
		 */
		this.fullTileRanges = null;

		/**
		 * @private
		 * @type {module:ol/size~Size}
		 */
		this.tmpSize = [0, 0];

		if (options.sizes !== undefined) {
			this.fullTileRanges = options.sizes.map((size) => {
				const tileRange = new TileRange(
					Math.min(0, size[0]), Math.max(size[0] - 1, -1),
					Math.min(0, size[1]), Math.max(size[1] - 1, -1));
				return tileRange;
			}, this);
		} else if (extent) {
			this.calculateTileRanges_(extent);
		}
	}

	/**
	 * Call a function with each tile coordinate for a given extent and zoom level.
	 *
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} zoom Integer zoom level.
	 * @param {function(module:ol/tilecoord~TileCoord)} callback Function called with each tile coordinate.
	 * @api
	 */
	public forEachTileCoord(extent: Extent, zoom: number, callback: (tilecoord: TileCoord) => void) {
		const tileRange = this.getTileRangeForExtentAndZ(extent, zoom);
		for (let i = tileRange.minX, ii = tileRange.maxX; i <= ii; ++i) {
			for (let j = tileRange.minY, jj = tileRange.maxY; j <= jj; ++j) {
				callback([zoom, i, j]);
			}
		}
	}


	/**
	 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
	 * @param {function(this: T, number, module:ol/TileRange): boolean} callback Callback.
	 * @param {T=} opt_this The object to use as `this` in `callback`.
	 * @param {module:ol/TileRange=} opt_tileRange Temporary module:ol/TileRange object.
	 * @param {module:ol/extent~Extent=} opt_extent Temporary module:ol/extent~Extent object.
	 * @return {boolean} Callback succeeded.
	 * @template T
	 */
	public forEachTileCoordParentTileRange<T>(tileCoord: TileCoord, callback: (this: T, z: number, tilerange: TileRange) => boolean, opt_this?: T, opt_tileRange?: TileRange, opt_extent?: Extent) {
		let z = tileCoord[0] - 1;
		if (this.zoomFactor === 2) {
			let x = tileCoord[1];
			let y = tileCoord[2];
			while (z >= this.minZoom) {
				x = Math.floor(x / 2);
				y = Math.floor(y / 2);
				const tileRange = createOrUpdateTileRange(x, x, y, y, opt_tileRange);
				if (callback.call(opt_this, z, tileRange)) {
					return true;
				}
				--z;
			}
		} else {
			const tileCoordExtent = this.getTileCoordExtent(tileCoord, opt_extent);
			while (z >= this.minZoom) {
				const tileRange = this.getTileRangeForExtentAndZ(tileCoordExtent, z, opt_tileRange);
				if (callback.call(opt_this, z, tileRange)) {
					return true;
				}
				--z;
			}
		}
		return false;
	}


	/**
	 * Get the extent for this tile grid, if it was configured.
	 * @return {module:ol/extent~Extent} Extent.
	 */
	public getExtent() {
		return this.extent;
	}


	/**
	 * Get the maximum zoom level for the grid.
	 * @return {number} Max zoom.
	 * @api
	 */
	public getMaxZoom() {
		return this.maxZoom;
	}


	/**
	 * Get the minimum zoom level for the grid.
	 * @return {number} Min zoom.
	 * @api
	 */
	public getMinZoom() {
		return this.minZoom;
	}


	/**
	 * Get the origin for the grid at the given zoom level.
	 * @param {number} z Integer zoom level.
	 * @return {module:ol/coordinate~Coordinate} Origin.
	 * @api
	 */
	public getOrigin(z: number) {
		if (this.origin) {
			return this.origin;
		} else {
			return this.origins![z];
		}
	}


	/**
	 * Get the resolution for the given zoom level.
	 * @param {number} z Integer zoom level.
	 * @return {number} Resolution.
	 * @api
	 */
	public getResolution(z: number) {
		return this.resolutions[z];
	}


	/**
	 * Get the list of resolutions for the tile grid.
	 * @return {Array.<number>} Resolutions.
	 * @api
	 */
	public getResolutions() {
		return this.resolutions;
	}


	/**
	 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
	 * @param {module:ol/TileRange=} opt_tileRange Temporary module:ol/TileRange object.
	 * @param {module:ol/extent~Extent=} opt_extent Temporary module:ol/extent~Extent object.
	 * @return {module:ol/TileRange} Tile range.
	 */
	public getTileCoordChildTileRange(tileCoord: TileCoord, opt_tileRange?: TileRange, opt_extent?: Extent) {
		if (tileCoord[0] < this.maxZoom) {
			if (this.zoomFactor === 2) {
				const minX = tileCoord[1] * 2;
				const minY = tileCoord[2] * 2;
				return createOrUpdateTileRange(minX, minX + 1, minY, minY + 1, opt_tileRange);
			}
			const tileCoordExtent = this.getTileCoordExtent(tileCoord, opt_extent);
			return this.getTileRangeForExtentAndZ(
				tileCoordExtent, tileCoord[0] + 1, opt_tileRange);
		}
		return null;
	}


	/**
	 * Get the extent for a tile range.
	 * @param {number} z Integer zoom level.
	 * @param {module:ol/TileRange} tileRange Tile range.
	 * @param {module:ol/extent~Extent=} opt_extent Temporary module:ol/extent~Extent object.
	 * @return {module:ol/extent~Extent} Extent.
	 */
	public getTileRangeExtent(z: number, tileRange: TileRange, opt_extent?: Extent) {
		const origin = this.getOrigin(z);
		const resolution = this.getResolution(z);
		const tileSize = toSize(this.getTileSize(z), this.tmpSize);
		const minX = origin[0] + tileRange.minX * tileSize[0] * resolution;
		const maxX = origin[0] + (tileRange.maxX + 1) * tileSize[0] * resolution;
		const minY = origin[1] + tileRange.minY * tileSize[1] * resolution;
		const maxY = origin[1] + (tileRange.maxY + 1) * tileSize[1] * resolution;
		return createOrUpdate(minX, minY, maxX, maxY, opt_extent);
	}


	/**
	 * Get a tile range for the given extent and integer zoom level.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} z Integer zoom level.
	 * @param {module:ol/TileRange=} opt_tileRange Temporary tile range object.
	 * @return {module:ol/TileRange} Tile range.
	 */
	public getTileRangeForExtentAndZ(extent: Extent, z: number, opt_tileRange?: TileRange) {
		const tileCoord = tmpTileCoord;
		this.getTileCoordForXYAndZ_(extent[0], extent[1], z, false, tileCoord);
		const minX = tileCoord[1];
		const minY = tileCoord[2];
		this.getTileCoordForXYAndZ_(extent[2], extent[3], z, true, tileCoord);
		return createOrUpdateTileRange(minX, tileCoord[1], minY, tileCoord[2], opt_tileRange);
	}


	/**
	 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
	 * @return {module:ol/coordinate~Coordinate} Tile center.
	 */
	public getTileCoordCenter(tileCoord: TileCoord) {
		const origin = this.getOrigin(tileCoord[0]);
		const resolution = this.getResolution(tileCoord[0]);
		const tileSize = toSize(this.getTileSize(tileCoord[0]), this.tmpSize);
		return [
			origin[0] + (tileCoord[1] + 0.5) * tileSize[0] * resolution,
			origin[1] + (tileCoord[2] + 0.5) * tileSize[1] * resolution
		] as Coordinate;
	}


	/**
	 * Get the extent of a tile coordinate.
	 *
	 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
	 * @param {module:ol/extent~Extent=} opt_extent Temporary extent object.
	 * @return {module:ol/extent~Extent} Extent.
	 * @api
	 */
	public getTileCoordExtent(tileCoord: TileCoord, opt_extent?: Extent) {
		const origin = this.getOrigin(tileCoord[0]);
		const resolution = this.getResolution(tileCoord[0]);
		const tileSize = toSize(this.getTileSize(tileCoord[0]), this.tmpSize);
		const minX = origin[0] + tileCoord[1] * tileSize[0] * resolution;
		const minY = origin[1] + tileCoord[2] * tileSize[1] * resolution;
		const maxX = minX + tileSize[0] * resolution;
		const maxY = minY + tileSize[1] * resolution;
		return createOrUpdate(minX, minY, maxX, maxY, opt_extent);
	}


	/**
	 * Get the tile coordinate for the given map coordinate and resolution.  This
	 * method considers that coordinates that intersect tile boundaries should be
	 * assigned the higher tile coordinate.
	 *
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {number} resolution Resolution.
	 * @param {module:ol/tilecoord~TileCoord=} opt_tileCoord Destination module:ol/tilecoord~TileCoord object.
	 * @return {module:ol/tilecoord~TileCoord} Tile coordinate.
	 * @api
	 */
	public getTileCoordForCoordAndResolution(coordinate: Coordinate, resolution: number, opt_tileCoord?: TileCoord) {
		return this.getTileCoordForXYAndResolution_(
			coordinate[0], coordinate[1], resolution, false, opt_tileCoord);
	}


	/**
	 * Get a tile coordinate given a map coordinate and zoom level.
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {number} z Zoom level.
	 * @param {module:ol/tilecoord~TileCoord=} opt_tileCoord Destination module:ol/tilecoord~TileCoord object.
	 * @return {module:ol/tilecoord~TileCoord} Tile coordinate.
	 * @api
	 */
	public getTileCoordForCoordAndZ(coordinate: Coordinate, z: number, opt_tileCoord?: TileCoord) {
		return this.getTileCoordForXYAndZ_(
			coordinate[0], coordinate[1], z, false, opt_tileCoord);
	}


	/**
	 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
	 * @return {number} Tile resolution.
	 */
	public getTileCoordResolution(tileCoord: TileCoord) {
		return this.resolutions[tileCoord[0]];
	}


	/**
	 * Get the tile size for a zoom level. The type of the return value matches the
	 * `tileSize` or `tileSizes` that the tile grid was configured with. To always
	 * get an `module:ol/size~Size`, run the result through `module:ol/size~Size.toSize()`.
	 * @param {number} z Z.
	 * @return {number|module:ol/size~Size} Tile size.
	 * @api
	 */
	public getTileSize(z: number) {
		if (this.tileSize) {
			return this.tileSize;
		} else {
			return this.tileSizes![z];
		}
	}


	/**
	 * @param {number} z Zoom level.
	 * @return {module:ol/TileRange} Extent tile range for the specified zoom level.
	 */
	public getFullTileRange(z: number) {
		if (!this.fullTileRanges) {
			return null;
		} else {
			return this.fullTileRanges[z];
		}
	}


	/**
	 * @param {number} resolution Resolution.
	 * @param {number=} opt_direction If 0, the nearest resolution will be used.
	 *     If 1, the nearest lower resolution will be used. If -1, the nearest
	 *     higher resolution will be used. Default is 0.
	 * @return {number} Z.
	 * @api
	 */
	public getZForResolution(resolution: number, opt_direction?: number) {
		const z = linearFindNearest(this.resolutions, resolution, opt_direction || 0);
		return clamp(z, this.minZoom, this.maxZoom);
	}

	/**
	 * Note that this method should not be called for resolutions that correspond
	 * to an integer zoom level.  Instead call the `getTileCoordForXYAndZ_` method.
	 * @param {number} x X.
	 * @param {number} y Y.
	 * @param {number} resolution Resolution (for a non-integer zoom level).
	 * @param {boolean} reverseIntersectionPolicy Instead of letting edge
	 *     intersections go to the higher tile coordinate, let edge intersections
	 *     go to the lower tile coordinate.
	 * @param {module:ol/tilecoord~TileCoord=} opt_tileCoord Temporary module:ol/tilecoord~TileCoord object.
	 * @return {module:ol/tilecoord~TileCoord} Tile coordinate.
	 * @private
	 */
	private getTileCoordForXYAndResolution_(
		x: number, y: number, resolution: number, reverseIntersectionPolicy: boolean, opt_tileCoord?: TileCoord) {
		const z = this.getZForResolution(resolution);
		const scale = resolution / this.getResolution(z);
		const origin = this.getOrigin(z);
		const tileSize = toSize(this.getTileSize(z), this.tmpSize);

		const adjustX = reverseIntersectionPolicy ? 0.5 : 0;
		const adjustY = reverseIntersectionPolicy ? 0 : 0.5;
		const xFromOrigin = Math.floor((x - origin[0]) / resolution + adjustX);
		const yFromOrigin = Math.floor((y - origin[1]) / resolution + adjustY);
		let tileCoordX = scale * xFromOrigin / tileSize[0];
		let tileCoordY = scale * yFromOrigin / tileSize[1];

		if (reverseIntersectionPolicy) {
			tileCoordX = Math.ceil(tileCoordX) - 1;
			tileCoordY = Math.ceil(tileCoordY) - 1;
		} else {
			tileCoordX = Math.floor(tileCoordX);
			tileCoordY = Math.floor(tileCoordY);
		}

		return createOrUpdateTileCoord(z, tileCoordX, tileCoordY, opt_tileCoord);
	}


	/**
	 * Although there is repetition between this method and `getTileCoordForXYAndResolution_`,
	 * they should have separate implementations.  This method is for integer zoom
	 * levels.  The other method should only be called for resolutions corresponding
	 * to non-integer zoom levels.
	 * @param {number} x Map x coordinate.
	 * @param {number} y Map y coordinate.
	 * @param {number} z Integer zoom level.
	 * @param {boolean} reverseIntersectionPolicy Instead of letting edge
	 *     intersections go to the higher tile coordinate, let edge intersections
	 *     go to the lower tile coordinate.
	 * @param {module:ol/tilecoord~TileCoord=} opt_tileCoord Temporary module:ol/tilecoord~TileCoord object.
	 * @return {module:ol/tilecoord~TileCoord} Tile coordinate.
	 * @private
	 */
	private getTileCoordForXYAndZ_(x: number, y: number, z: number, reverseIntersectionPolicy: boolean, opt_tileCoord?: TileCoord) {
		const origin = this.getOrigin(z);
		const resolution = this.getResolution(z);
		const tileSize = toSize(this.getTileSize(z), this.tmpSize);

		const adjustX = reverseIntersectionPolicy ? 0.5 : 0;
		const adjustY = reverseIntersectionPolicy ? 0 : 0.5;
		const xFromOrigin = Math.floor((x - origin[0]) / resolution + adjustX);
		const yFromOrigin = Math.floor((y - origin[1]) / resolution + adjustY);
		let tileCoordX = xFromOrigin / tileSize[0];
		let tileCoordY = yFromOrigin / tileSize[1];

		if (reverseIntersectionPolicy) {
			tileCoordX = Math.ceil(tileCoordX) - 1;
			tileCoordY = Math.ceil(tileCoordY) - 1;
		} else {
			tileCoordX = Math.floor(tileCoordX);
			tileCoordY = Math.floor(tileCoordY);
		}

		return createOrUpdateTileCoord(z, tileCoordX, tileCoordY, opt_tileCoord);
	}
	/**
	 * @param {!module:ol/extent~Extent} extent Extent for this tile grid.
	 * @private
	 */
	private calculateTileRanges_(extent: Extent) {
		const length = this.resolutions.length;
		const fullTileRanges = new Array(length);
		for (let z = this.minZoom; z < length; ++z) {
			fullTileRanges[z] = this.getTileRangeForExtentAndZ(extent, z);
		}
		this.fullTileRanges = fullTileRanges;
	}
}
