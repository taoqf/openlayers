/**
 * @module ol/tilegrid/WMTS
 */
import { find } from '../array';
import { Coordinate } from '../coordinate';
import { Extent } from '../extent';
import { get as getProjection } from '../proj';
import { Size } from '../size';
import TileGrid from '../tilegrid/TileGrid';


/**
 * @typedef {Object} Options
 * @property {module:ol/extent~Extent} [extent] Extent for the tile grid. No tiles
 * outside this extent will be requested by {@link module:ol/source/Tile} sources.
 * When no `origin` or `origins` are configured, the `origin` will be set to the
 * top-left corner of the extent.
 * @property {module:ol/coordinate~Coordinate} [origin] The tile grid origin, i.e.
 * where the `x` and `y` axes meet (`[z, 0, 0]`). Tile coordinates increase left
 * to right and upwards. If not specified, `extent` or `origins` must be provided.
 * @property {Array.<module:ol/coordinate~Coordinate>} [origins] Tile grid origins,
 * i.e. where the `x` and `y` axes meet (`[z, 0, 0]`), for each zoom level. If
 * given, the array length should match the length of the `resolutions` array, i.e.
 * each resolution can have a different origin. Tile coordinates increase left to
 * right and upwards. If not specified, `extent` or `origin` must be provided.
 * @property {!Array.<number>} resolutions Resolutions. The array index of each
 * resolution needs to match the zoom level. This means that even if a `minZoom`
 * is configured, the resolutions array will have a length of `maxZoom + 1`
 * @property {!Array.<string>} matrixIds matrix IDs. The length of this array needs
 * to match the length of the `resolutions` array.
 * @property {Array.<module:ol/size~Size>} [sizes] Number of tile rows and columns
 * of the grid for each zoom level. The values here are the `TileMatrixWidth` and
 * `TileMatrixHeight` advertised in the GetCapabilities response of the WMTS, and
 * define the grid's extent together with the `origin`.
 * An `extent` can be configured in addition, and will further limit the extent for
 * which tile requests are made by sources. Note that when the top-left corner of
 * the `extent` is used as `origin` or `origins`, then the `y` value must be
 * negative because OpenLayers tile coordinates increase upwards.
 * @property {number|module:ol/size~Size} [tileSize] Tile size.
 * @property {Array.<module:ol/size~Size>} [tileSizes] Tile sizes. The length of
 * this array needs to match the length of the `resolutions` array.
 * @property {Array.<number>} [widths] Number of tile columns that cover the grid's
 * extent for each zoom level. Only required when used with a source that has `wrapX`
 * set to `true`, and only when the grid's origin differs from the one of the
 * projection's extent. The array length has to match the length of the `resolutions`
 * array, i.e. each resolution will have a matching entry here.
 */
export interface Options {
	extent: Extent;
	origin: Coordinate;
	origins: Coordinate[];
	resolutions: number[];
	matrixIds: string[];
	sizes: Size[];
	tileSize: Size;
	tileSizes: Size[];
	widths: number[];
}

/**
 * @classdesc
 * Set the grid pattern for sources accessing WMTS tiled-image servers.
 *
 * @constructor
 * @extends {module:ol/tilegrid/TileGrid}
 * @param {module:ol/tilegrid/WMTS~Options} options WMTS options.
 * @struct
 * @api
 */
export default class WMTSTileGrid extends TileGrid {
	private matrixIds_: string[];
	constructor(options?: Partial<Options>) {
		super({
			extent: options.extent,
			origin: options.origin,
			origins: options.origins,
			resolutions: options.resolutions,
			sizes: options.sizes,
			tileSize: options.tileSize,
			tileSizes: options.tileSizes
		});
		/**
		 * @private
		 * @type {!Array.<string>}
		 */
		this.matrixIds_ = options.matrixIds;
		// FIXME: should the matrixIds become optional?
	}

	/**
	 * @param {number} z Z.
	 * @return {string} MatrixId..
	 */
	public getMatrixId(z: number) {
		return this.matrixIds_[z];
	}


	/**
	 * Get the list of matrix identifiers.
	 * @return {Array.<string>} MatrixIds.
	 * @api
	 */
	public getMatrixIds() {
		return this.matrixIds_;
	}
}

/**
 * Create a tile grid from a WMTS capabilities matrix set and an
 * optional TileMatrixSetLimits.
 * @param {Object} matrixSet An object representing a matrixSet in the
 *     capabilities document.
 * @param {module:ol/extent~Extent=} opt_extent An optional extent to restrict the tile
 *     ranges the server provides.
 * @param {Array.<Object>=} opt_matrixLimits An optional object representing
 *     the available matrices for tileGrid.
 * @return {module:ol/tilegrid/WMTS} WMTS tileGrid instance.
 * @api
 */
export function createFromCapabilitiesMatrixSet(matrixSet: { [key: string]: string | Array<{ [k: string]: string | number | Coordinate; }>; }, opt_extent?: Extent, opt_matrixLimits?: any[]) {
	const resolutions = [] as number[];
	const matrixIds = [] as string[];
	const origins = [] as Coordinate[];
	const tileSizes = [] as Size[];
	const sizes = [] as Size[];

	const matrixLimits = opt_matrixLimits !== undefined ? opt_matrixLimits : [];

	const supportedCRSPropName = 'SupportedCRS';
	const matrixIdsPropName = 'TileMatrix';
	const identifierPropName = 'Identifier';
	const scaleDenominatorPropName = 'ScaleDenominator';
	const topLeftCornerPropName = 'TopLeftCorner';
	const tileWidthPropName = 'TileWidth';
	const tileHeightPropName = 'TileHeight';

	const code = matrixSet[supportedCRSPropName] as string;
	const projection = getProjection(code.replace(/urn:ogc:def:crs:(\w+):(.*:)?(\w+)$/, '$1:$3')) ||
		getProjection(code);
	const metersPerUnit = projection.getMetersPerUnit();
	// swap origin x and y coordinates if axis orientation is lat/long
	const switchOriginXY = projection.getAxisOrientation().substr(0, 2) === 'ne';

	(matrixSet[matrixIdsPropName] as Array<{ [k: string]: number; }>).sort((a, b) => {
		return b[scaleDenominatorPropName] - a[scaleDenominatorPropName];
	});

	(matrixSet[matrixIdsPropName] as Array<{ [k: string]: string | number | Coordinate; }>).forEach((elt) => {

		let matrixAvailable;
		// use of matrixLimits to filter TileMatrices from GetCapabilities
		// TileMatrixSet from unavailable matrix levels.
		if (matrixLimits.length > 0) {
			matrixAvailable = find(matrixLimits, (elt_ml) => {
				if (elt[identifierPropName] === elt_ml[matrixIdsPropName]) {
					return true;
				}
				// Fallback for tileMatrix identifiers that don't get prefixed
				// by their tileMatrixSet identifiers.
				if ((elt[identifierPropName] as string).indexOf(':') === -1) {
					return matrixSet[identifierPropName] + ':' + elt[identifierPropName] === elt_ml[matrixIdsPropName];
				}
				return false;
			});
		} else {
			matrixAvailable = true;
		}

		if (matrixAvailable) {
			matrixIds.push(elt[identifierPropName] as string);
			const resolution = (elt[scaleDenominatorPropName] as number) * 0.28E-3 / metersPerUnit;
			const tileWidth = elt[tileWidthPropName] as number;
			const tileHeight = elt[tileHeightPropName] as number;
			if (switchOriginXY) {
				origins.push([(elt[topLeftCornerPropName] as number[])[1],
				(elt[topLeftCornerPropName] as number[])[0]]);
			} else {
				origins.push(elt[topLeftCornerPropName] as Coordinate);
			}
			resolutions.push(resolution);
			tileSizes.push(tileWidth === tileHeight ?
				tileWidth as any as Size : [tileWidth, tileHeight]);	// todo as any???
			// top-left origin, so height is negative
			sizes.push([elt.MatrixWidth as number, -elt.MatrixHeight]);
		}
	});

	return new WMTSTileGrid({
		extent: opt_extent,
		matrixIds,
		origins,
		resolutions,
		sizes,
		tileSizes
	});
}
