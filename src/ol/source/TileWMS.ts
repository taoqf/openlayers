/**
 * @module ol/source/TileWMS
 */

import { assert } from '../asserts';
import { Coordinate } from '../coordinate';
import { buffer, createEmpty, Extent } from '../extent';
import { TileClass } from '../ImageTile';
import { modulo } from '../math';
import { assign } from '../obj';
import { get as getProjection, ProjectionLike, transform, transformExtent } from '../proj';
import Projection from '../proj/Projection';
import { calculateSourceResolution } from '../reproj';
import { buffer as bufferSize, scale as scaleSize, Size, toSize } from '../size';
import TileImage from '../source/TileImage';
import WMSServerType from '../source/WMSServerType';
import { compareVersions } from '../string';
import { LoadFunction } from '../Tile';
import { hash as tileCoordHash, TileCoord } from '../tilecoord';
import TileGrid from '../tilegrid/TileGrid';
import { appendParams } from '../uri';
import { DEFAULT_WMS_VERSION } from './common';
import { AttributionLike } from './Source';

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {number} [cacheSize=2048] Cache size.
 * @property {null|string} [crossOrigin] The `crossOrigin` attribute for loaded images.  Note that
 * you must provide a `crossOrigin` value if you are using the WebGL renderer or if you want to
 * access pixel data with the Canvas renderer.  See
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image} for more detail.
 * @property {Object.<string,*>} params WMS request parameters.
 * At least a `LAYERS` param is required. `STYLES` is
 * `''` by default. `VERSION` is `1.3.0` by default. `WIDTH`, `HEIGHT`, `BBOX`
 * and `CRS` (`SRS` for WMS version < 1.3.0) will be set dynamically.
 * @property {number} [gutter=0]
 * The size in pixels of the gutter around image tiles to ignore. By setting
 * this property to a non-zero value, images will be requested that are wider
 * and taller than the tile size by a value of `2 x gutter`.
 * Using a non-zero value allows artifacts of rendering at tile edges to be
 * ignored. If you control the WMS service it is recommended to address
 * "artifacts at tile edges" issues by properly configuring the WMS service. For
 * example, MapServer has a `tile_map_edge_buffer` configuration parameter for
 * this. See http://mapserver.org/output/tile_mode.html.
 * @property {boolean} [hidpi=true] Use the `ol/Map#pixelRatio` value when requesting
 * the image from the remote server.
 * @property {module:ol/proj~ProjectionLike} projection Projection.
 * @property {number} [reprojectionErrorThreshold=0.5] Maximum allowed reprojection error (in pixels).
 * Higher values can increase reprojection performance, but decrease precision.
 * @property {module:ol/ImageTile~TileClass} [tileClass] Class used to instantiate image tiles.
 * Default is {@link module:ol/ImageTile~TileClass}.
 * @property {module:ol/tilegrid/TileGrid} [tileGrid] Tile grid. Base this on the resolutions,
 * tilesize and extent supported by the server.
 * If this is not defined, a default grid will be used: if there is a projection
 * extent, the grid will be based on that; if not, a grid based on a global
 * extent with origin at 0,0 will be used..
 * @property {module:ol/source/WMSServerType|string} [serverType]
 * The type of the remote WMS server. Currently only used when `hidpi` is
 * `true`.
 * @property {module:ol/Tile~LoadFunction} [tileLoadFunction] Optional function to load a tile given a URL. The default is
 * ```js
 * function(imageTile, src) {
 *   imageTile.getImage().src = src;
 * };
 * ```
 * @property {string} [url] WMS service URL.
 * @property {Array.<string>} [urls] WMS service urls.
 * Use this instead of `url` when the WMS supports multiple urls for GetMap requests.
 * @property {boolean} [wrapX=true] Whether to wrap the world horizontally.
 * When set to `false`, only one world
 * will be rendered. When `true`, tiles will be requested for one world only,
 * but they will be wrapped horizontally to render multiple worlds.
 * @property {number} [transition] Duration of the opacity transition for rendering.
 * To disable the opacity transition, pass `transition: 0`.
 */

export interface Options {
	attributions: AttributionLike;
	cacheSize: number;
	crossOrigin: null | string;
	params: { [s: string]: any; };
	gutter: number;
	hidpi: boolean;
	projection: ProjectionLike;
	reprojectionErrorThreshold: number;
	tileClass: TileClass;
	tileGrid: TileGrid;
	serverType: WMSServerType | string;
	tileLoadFunction: LoadFunction;
	url: string;
	urls: string[];
	wrapX: boolean;
	transition: number;
}

/**
 * @classdesc
 * Layer source for tile data from WMS servers.
 *
 * @constructor
 * @extends {module:ol/source/TileImage}
 * @param {module:ol/source/TileWMS~Options=} [opt_options] Tile WMS options.
 * @api
 */
export default class TileWMS extends TileImage {
	private gutter_: number;
	private params_: { [s: string]: any; };
	private v13_: boolean;
	private serverType_: string | undefined;
	private hidpi_: boolean;
	private tmpExtent_: Extent;
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options || {};

		const params = options.params || {};

		const transparent = 'TRANSPARENT' in params ? params.TRANSPARENT : true;

		super({
			attributions: options.attributions,
			cacheSize: options.cacheSize,
			crossOrigin: options.crossOrigin,
			opaque: !transparent,
			projection: options.projection,
			reprojectionErrorThreshold: options.reprojectionErrorThreshold,
			tileClass: options.tileClass,
			tileGrid: options.tileGrid,
			tileLoadFunction: options.tileLoadFunction,
			transition: options.transition,
			url: options.url,
			urls: options.urls,
			wrapX: options.wrapX !== undefined ? options.wrapX : true
		});

		/**
		 * @private
		 * @type {number}
		 */
		this.gutter_ = options.gutter !== undefined ? options.gutter : 0;

		/**
		 * @private
		 * @type {!Object}
		 */
		this.params_ = params;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.v13_ = true;

		/**
		 * @private
		 * @type {module:ol/source/WMSServerType|undefined}
		 */
		this.serverType_ = /** @type {module:ol/source/WMSServerType|undefined} */ (options.serverType);

		/**
		 * @private
		 * @type {boolean}
		 */
		this.hidpi_ = options.hidpi !== undefined ? options.hidpi : true;

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.tmpExtent_ = createEmpty();

		this.updateV13_();
		this.setKey(this.getKeyForParams_());

	}

	/**
	 * Return the GetFeatureInfo URL for the passed coordinate, resolution, and
	 * projection. Return `undefined` if the GetFeatureInfo URL cannot be
	 * constructed.
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {number} resolution Resolution.
	 * @param {module:ol/proj~ProjectionLike} projection Projection.
	 * @param {!Object} params GetFeatureInfo params. `INFO_FORMAT` at least should
	 *     be provided. If `QUERY_LAYERS` is not provided then the layers specified
	 *     in the `LAYERS` parameter will be used. `VERSION` should not be
	 *     specified here.
	 * @return {string|undefined} GetFeatureInfo URL.
	 * @api
	 */
	public getGetFeatureInfoUrl(coordinate: Coordinate, resolution: number, projection: ProjectionLike, params: any) {
		const projectionObj = getProjection(projection)!;
		const sourceProjectionObj = this.getProjection();

		let tileGrid = this.getTileGrid()!;
		if (!tileGrid) {
			tileGrid = this.getTileGridForProjection(projectionObj);
		}

		const tileCoord = tileGrid.getTileCoordForCoordAndResolution(coordinate, resolution);

		if (tileGrid.getResolutions().length <= tileCoord[0]) {
			return undefined;
		}

		let tileResolution = tileGrid.getResolution(tileCoord[0]);
		let tileExtent = tileGrid.getTileCoordExtent(tileCoord, this.tmpExtent_);
		let tileSize = toSize(tileGrid.getTileSize(tileCoord[0]), this.tmpSize);


		const gutter = this.gutter_;
		if (gutter !== 0) {
			tileSize = bufferSize(tileSize, gutter, this.tmpSize);
			tileExtent = buffer(tileExtent, tileResolution * gutter, tileExtent);
		}

		if (sourceProjectionObj && sourceProjectionObj !== projectionObj) {
			tileResolution = calculateSourceResolution(sourceProjectionObj, projectionObj, coordinate, tileResolution);
			tileExtent = transformExtent(tileExtent, projectionObj, sourceProjectionObj);
			coordinate = transform(coordinate, projectionObj, sourceProjectionObj);
		}

		const baseParams = {
			FORMAT: 'image/png',
			QUERY_LAYERS: this.params_.LAYERS,
			REQUEST: 'GetFeatureInfo',
			SERVICE: 'WMS',
			TRANSPARENT: true,
			VERSION: DEFAULT_WMS_VERSION
		} as {
				FORMAT: string;
				QUERY_LAYERS: any;
				REQUEST: string;
				SERVICE: string;
				TRANSPARENT: boolean;
				VERSION: string;
				I: number;
				J: number;
				X: number;
				Y: number;
			};
		assign(baseParams, this.params_, params);

		const x = Math.floor((coordinate[0] - tileExtent[0]) / tileResolution);
		const y = Math.floor((tileExtent[3] - coordinate[1]) / tileResolution);

		baseParams[this.v13_ ? 'I' : 'X'] = x;
		baseParams[this.v13_ ? 'J' : 'Y'] = y;

		return this.getRequestUrl_(tileCoord, tileSize, tileExtent,
			1, sourceProjectionObj || projectionObj, baseParams);
	}


	/**
	 * @inheritDoc
	 */
	public getGutterInternal() {
		return this.gutter_;
	}


	/**
	 * Get the user-provided params, i.e. those passed to the constructor through
	 * the "params" option, and possibly updated using the updateParams method.
	 * @return {Object} Params.
	 * @api
	 */
	public getParams() {
		return this.params_;
	}

	/**
	 * @inheritDoc
	 */
	public getTilePixelRatio(pixelRatio: number) {
		return (!this.hidpi_ || this.serverType_ === undefined) ? 1 :
		/** @type {number} */ (pixelRatio);
	}

	/**
	 * @inheritDoc
	 */
	public fixedTileUrlFunction(tileCoord: TileCoord, pixelRatio: number, projection: Projection) {

		let tileGrid = this.getTileGrid()!;
		if (!tileGrid) {
			tileGrid = this.getTileGridForProjection(projection);
		}

		if (tileGrid.getResolutions().length <= tileCoord[0]) {
			return undefined;
		}

		if (pixelRatio !== 1 && (!this.hidpi_ || this.serverType_ === undefined)) {
			pixelRatio = 1;
		}

		const tileResolution = tileGrid.getResolution(tileCoord[0]);
		let tileExtent = tileGrid.getTileCoordExtent(tileCoord, this.tmpExtent_);
		let tileSize = toSize(
			tileGrid.getTileSize(tileCoord[0]), this.tmpSize);

		const gutter = this.gutter_;
		if (gutter !== 0) {
			tileSize = bufferSize(tileSize, gutter, this.tmpSize);
			tileExtent = buffer(tileExtent, tileResolution * gutter, tileExtent);
		}

		if (pixelRatio !== 1) {
			tileSize = scaleSize(tileSize, pixelRatio, this.tmpSize);
		}

		const baseParams = {
			FORMAT: 'image/png',
			REQUEST: 'GetMap',
			SERVICE: 'WMS',
			TRANSPARENT: true,
			VERSION: DEFAULT_WMS_VERSION
		};
		assign(baseParams, this.params_);

		return this.getRequestUrl_(tileCoord, tileSize, tileExtent,
			pixelRatio, projection, baseParams);
	}

	/**
	 * Update the user-provided params.
	 * @param {Object} params Params.
	 * @api
	 */
	public updateParams(params: any) {
		assign(this.params_, params);
		this.updateV13_();
		this.setKey(this.getKeyForParams_());
	}


	/**
	 * @private
	 */
	private updateV13_() {
		const version = this.params_.VERSION || DEFAULT_WMS_VERSION;
		this.v13_ = compareVersions(version, '1.3') >= 0;
	}


	/**
	 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
	 * @param {module:ol/size~Size} tileSize Tile size.
	 * @param {module:ol/extent~Extent} tileExtent Tile extent.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {module:ol/proj/Projection} projection Projection.
	 * @param {Object} params Params.
	 * @return {string|undefined} Request URL.
	 * @private
	 */
	private getRequestUrl_(tileCoord: TileCoord, tileSize: Size, tileExtent: Extent, pixelRatio: number, projection: Projection, params: any) {

		const urls = this.urls;
		if (!urls) {
			return undefined;
		}

		params.WIDTH = tileSize[0];
		params.HEIGHT = tileSize[1];

		params[this.v13_ ? 'CRS' : 'SRS'] = projection.getCode();

		if (!('STYLES' in this.params_)) {
			params.STYLES = '';
		}

		if (pixelRatio !== 1) {
			switch (this.serverType_) {
				case WMSServerType.GEOSERVER:
					const dpi = (90 * pixelRatio + 0.5) | 0;
					if ('FORMAT_OPTIONS' in params) {
						params.FORMAT_OPTIONS += ';dpi:' + dpi;
					} else {
						params.FORMAT_OPTIONS = 'dpi:' + dpi;
					}
					break;
				case WMSServerType.MAPSERVER:
					params.MAP_RESOLUTION = 90 * pixelRatio;
					break;
				case WMSServerType.CARMENTA_SERVER:
				case WMSServerType.QGIS:
					params.DPI = 90 * pixelRatio;
					break;
				default:
					assert(false, 52); // Unknown `serverType` configured
					break;
			}
		}

		const axisOrientation = projection.getAxisOrientation();
		const bbox = tileExtent;
		if (this.v13_ && axisOrientation.substr(0, 2) === 'ne') {
			let tmp;
			tmp = tileExtent[0];
			bbox[0] = tileExtent[1];
			bbox[1] = tmp;
			tmp = tileExtent[2];
			bbox[2] = tileExtent[3];
			bbox[3] = tmp;
		}
		params.BBOX = bbox.join(',');

		let url;
		if (urls.length === 1) {
			url = urls[0];
		} else {
			const index = modulo(tileCoordHash(tileCoord), urls.length);
			url = urls[index];
		}
		return appendParams(url, params);
	}


	/**
	 * @private
	 * @return {string} The key for the current params.
	 */
	private getKeyForParams_() {
		const res = Object.keys(this.params_).map((key) => {
			return key + '-' + this.params_[key];
		});
		return res.join('/');
	}

}
