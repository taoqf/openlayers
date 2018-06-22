/**
 * @module ol/proj/Projection
 */
import { Coordinate } from '../coordinate';
import { Extent } from '../extent';
import Units, { METERS_PER_UNIT } from '../proj/Units';
import TileGrid from '../tilegrid/TileGrid';


/**
 * @typedef {Object} Options
 * @property {string} code The SRS identifier code, e.g. `EPSG:4326`.
 * @property {module:ol/proj/Units|string} [units] Units. Required unless a
 * proj4 projection is defined for `code`.
 * @property {module:ol/extent~Extent} [extent] The validity extent for the SRS.
 * @property {string} [axisOrientation='enu'] The axis orientation as specified in Proj4.
 * @property {boolean} [global=false] Whether the projection is valid for the whole globe.
 * @property {number} [metersPerUnit] The meters per unit for the SRS.
 * If not provided, the `units` are used to get the meters per unit from the {@link module:ol/proj/Units~METERS_PER_UNIT}
 * lookup table.
 * @property {module:ol/extent~Extent} [worldExtent] The world extent for the SRS.
 * @property {function(number, module:ol/coordinate~Coordinate):number} [getPointResolution]
 * Function to determine resolution at a point. The function is called with a
 * `{number}` view resolution and an `{module:ol/coordinate~Coordinate}` as arguments, and returns
 * the `{number}` resolution at the passed coordinate. If this is `undefined`,
 * the default {@link module:ol/proj#getPointResolution} function will be used.
 */

export interface Options {
	code: string;
	units: Units;
	extent?: Extent;
	worldExtent?: Extent;
	axisOrientation?: string;
	global?: boolean;
	metersPerUnit?: number;
	getPointResolution?(view_resolution: number, coordinate: Coordinate): number;
}

/**
 * @classdesc
 * Projection definition class. One of these is created for each projection
 * supported in the application and stored in the {@link module:ol/proj} namespace.
 * You can use these in applications, but this is not required, as API params
 * and options use {@link module:ol/proj~ProjectionLike} which means the simple string
 * code will suffice.
 *
 * You can use {@link module:ol/proj~get} to retrieve the object for a particular
 * projection.
 *
 * The library includes definitions for `EPSG:4326` and `EPSG:3857`, together
 * with the following aliases:
 * * `EPSG:4326`: CRS:84, urn:ogc:def:crs:EPSG:6.6:4326,
 *     urn:ogc:def:crs:OGC:1.3:CRS84, urn:ogc:def:crs:OGC:2:84,
 *     http://www.opengis.net/gml/srs/epsg.xml#4326,
 *     urn:x-ogc:def:crs:EPSG:4326
 * * `EPSG:3857`: EPSG:102100, EPSG:102113, EPSG:900913,
 *     urn:ogc:def:crs:EPSG:6.18:3:3857,
 *     http://www.opengis.net/gml/srs/epsg.xml#3857
 *
 * If you use proj4js, aliases can be added using `proj4.defs()`; see
 * [documentation](https://github.com/proj4js/proj4js). To set an alternative
 * namespace for proj4, use {@link module:ol/proj~setProj4}.
 *
 * @constructor
 * @param {module:ol/proj/Projection~Options} options Projection options.
 * @struct
 * @api
 */
export default class Projection {
	private code: string;
	private units: Units;
	private extent: Extent | null;
	private worldExtent: Extent | null;
	private axisOrientation: string;
	private global: boolean;
	private can_wrap_x: boolean;
	private metersPerUnit: number | undefined;
	private get_point_resolution_func?: (view_resolution: number, coordinate: Coordinate) => number;
	private defaultTileGrid: TileGrid | null;
	constructor(options: Options) {
		/**
		 * @private
		 * @type {string}
		 */
		this.code = options.code;

		/**
		 * Units of projected coordinates. When set to `TILE_PIXELS`, a
		 * `this.extent_` and `this.worldExtent_` must be configured properly for each
		 * tile.
		 * @private
		 * @type {module:ol/proj/Units}
		 */
		this.units = /** @type {module:ol/proj/Units} */ (options.units);

		/**
		 * Validity extent of the projection in projected coordinates. For projections
		 * with `TILE_PIXELS` units, this is the extent of the tile in
		 * tile pixel space.
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.extent = options.extent !== undefined ? options.extent : null;

		/**
		 * Extent of the world in EPSG:4326. For projections with
		 * `TILE_PIXELS` units, this is the extent of the tile in
		 * projected coordinate space.
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.worldExtent = options.worldExtent !== undefined ?
			options.worldExtent : null;

		/**
		 * @private
		 * @type {string}
		 */
		this.axisOrientation = options.axisOrientation !== undefined ?
			options.axisOrientation : 'enu';

		/**
		 * @private
		 * @type {boolean}
		 */
		this.global = options.global !== undefined ? options.global : false;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.can_wrap_x = !!(this.global && this.extent);

		/**
		 * @private
		 * @type {function(number, module:ol/coordinate~Coordinate):number|undefined}
		 */
		this.get_point_resolution_func = options.getPointResolution;

		/**
		 * @private
		 * @type {module:ol/tilegrid/TileGrid}
		 */
		this.defaultTileGrid = null;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.metersPerUnit = options.metersPerUnit;
	}

	/**
	 * @return {boolean} The projection is suitable for wrapping the x-axis
	 */
	public canWrapX() {
		return this.can_wrap_x;
	}

	/**
	 * Get the code for this projection, e.g. 'EPSG:4326'.
	 * @return {string} Code.
	 * @api
	 */
	public getCode() {
		return this.code;
	}

	/**
	 * Get the validity extent for this projection.
	 * @return {module:ol/extent~Extent} Extent.
	 * @api
	 */
	public getExtent() {
		return this.extent;
	}

	/**
	 * Get the units of this projection.
	 * @return {module:ol/proj/Units} Units.
	 * @api
	 */
	public getUnits() {
		return this.units;
	}


	/**
	 * Get the amount of meters per unit of this projection.  If the projection is
	 * not configured with `metersPerUnit` or a units identifier, the return is
	 * `undefined`.
	 * @return {number|undefined} Meters.
	 * @api
	 */
	public getMetersPerUnit() {
		return this.metersPerUnit || METERS_PER_UNIT[this.units];
	}


	/**
	 * Get the world extent for this projection.
	 * @return {module:ol/extent~Extent} Extent.
	 * @api
	 */
	public getWorldExtent() {
		return this.worldExtent;
	}


	/**
	 * Get the axis orientation of this projection.
	 * Example values are:
	 * enu - the default easting, northing, elevation.
	 * neu - northing, easting, up - useful for "lat/long" geographic coordinates,
	 *     or south orientated transverse mercator.
	 * wnu - westing, northing, up - some planetary coordinate systems have
	 *     "west positive" coordinate systems
	 * @return {string} Axis orientation.
	 * @api
	 */
	public getAxisOrientation() {
		return this.axisOrientation;
	}


	/**
	 * Is this projection a global projection which spans the whole world?
	 * @return {boolean} Whether the projection is global.
	 * @api
	 */
	public isGlobal() {
		return this.global;
	}


	/**
	 * Set if the projection is a global projection which spans the whole world
	 * @param {boolean} global Whether the projection is global.
	 * @api
	 */
	public setGlobal(global: boolean) {
		this.global = global;
		this.can_wrap_x = !!(global && this.extent);
	}

	/**
	 * @return {module:ol/tilegrid/TileGrid} The default tile grid.
	 */
	public getDefaultTileGrid() {
		return this.defaultTileGrid;
	}

	/**
	 * @param {module:ol/tilegrid/TileGrid} tileGrid The default tile grid.
	 */
	public setDefaultTileGrid(tileGrid: TileGrid) {
		this.defaultTileGrid = tileGrid;
	}


	/**
	 * Set the validity extent for this projection.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @api
	 */
	public setExtent(extent: Extent) {
		this.extent = extent;
		this.can_wrap_x = !!(this.global && extent);
	}


	/**
	 * Set the world extent for this projection.
	 * @param {module:ol/extent~Extent} worldExtent World extent
	 *     [minlon, minlat, maxlon, maxlat].
	 * @api
	 */
	public setWorldExtent(worldExtent: Extent) {
		this.worldExtent = worldExtent;
	}


	/**
	 * Set the getPointResolution function (see {@link module:ol/proj~getPointResolution}
	 * for this projection.
	 * @param {function(number, module:ol/coordinate~Coordinate):number} func Function
	 * @api
	 */
	public setGetPointResolution(func: (view_resolution: number, coordinate: Coordinate) => number) {
		this.get_point_resolution_func = func;
	}


	/**
	 * Get the custom point resolution function for this projection (if set).
	 * @return {function(number, module:ol/coordinate~Coordinate):number|undefined} The custom point
	 * resolution function (if set).
	 */
	public getPointResolutionFunc() {
		return this.get_point_resolution_func;
	}
}
