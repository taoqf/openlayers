/**
 * @module ol/source/XYZ
 */
import { ProjectionLike } from '../proj';
import { Size } from '../size';
import TileImage from '../source/TileImage';
import { LoadFunction, UrlFunction } from '../Tile';
import { createXYZ, extentFromProjection } from '../tilegrid';
import TileGrid from '../tilegrid/TileGrid';
import { AttributionLike } from './Source';
import SourceState from './State';

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {number} [cacheSize=2048] Cache size.
 * @property {null|string} [crossOrigin] The `crossOrigin` attribute for loaded images.  Note that
 * you must provide a `crossOrigin` value if you are using the WebGL renderer or if you want to
 * access pixel data with the Canvas renderer.  See
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image} for more detail.
 * @property {boolean} [opaque=true] Whether the layer is opaque.
 * @property {module:ol/proj~ProjectionLike} [projection='EPSG:3857'] Projection.
 * @property {boolean} [reprojectionErrorThreshold=0.5] Maximum allowed reprojection error (in pixels).
 * Higher values can increase reprojection performance, but decrease precision.
 * @property {number} [maxZoom=18] Optional max zoom level.
 * @property {number} [minZoom=0] Optional min zoom level.
 * @property {module:ol/tilegrid/TileGrid} [tileGrid] Tile grid.
 * @property {module:ol/Tile~LoadFunction} [tileLoadFunction] Optional function to load a tile given a URL. The default is
 * ```js
 * function(imageTile, src) {
 *   imageTile.getImage().src = src;
 * };
 * ```
 * @property {number} [tilePixelRatio=1] The pixel ratio used by the tile service.
 * For example, if the tile service advertizes 256px by 256px tiles but actually sends 512px
 * by 512px images (for retina/hidpi devices) then `tilePixelRatio`
 * should be set to `2`.
 * @property {number|module:ol/size~Size} [tileSize=[256, 256]] The tile size used by the tile service.
 * @property {module:ol/Tile~UrlFunction} [tileUrlFunction] Optional function to get
 * tile URL given a tile coordinate and the projection.
 * Required if url or urls are not provided.
 * @property {string} [url] URL template. Must include `{x}`, `{y}` or `{-y}`,
 * and `{z}` placeholders. A `{?-?}` template pattern, for example `subdomain{a-f}.domain.com`,
 * may be used instead of defining each one separately in the `urls` option.
 * @property {Array.<string>} [urls] An array of URL templates.
 * @property {boolean} [wrapX=true] Whether to wrap the world horizontally.
 * @property {number} [transition] Duration of the opacity transition for rendering.
 * To disable the opacity transition, pass `transition: 0`.
 */

export interface Options {
	attributions: AttributionLike;
	cacheSize: number;
	crossOrigin: null | string;
	opaque: boolean;
	projection: ProjectionLike;
	reprojectionErrorThreshold: number;	// todo string?
	maxZoom: number;
	minZoom: number;
	tileGrid: TileGrid;
	tileLoadFunction: LoadFunction;
	tilePixelRatio: number;
	tileSize: number | Size;
	tileUrlFunction: UrlFunction;
	url: string;
	urls: string[];
	wrapX: boolean;
	transition: number;
	state: SourceState;
}


/**
 * @classdesc
 * Layer source for tile data with URLs in a set XYZ format that are
 * defined in a URL template. By default, this follows the widely-used
 * Google grid where `x` 0 and `y` 0 are in the top left. Grids like
 * TMS where `x` 0 and `y` 0 are in the bottom left can be used by
 * using the `{-y}` placeholder in the URL template, so long as the
 * source does not have a custom tile grid. In this case,
 * {@link module:ol/source/TileImage} can be used with a `tileUrlFunction`
 * such as:
 *
 *  tileUrlFunction: function(coordinate) {
 *    return 'http://mapserver.com/' + coordinate[0] + '/' +
 *        coordinate[1] + '/' + coordinate[2] + '.png';
 *    }
 *
 *
 * @constructor
 * @extends {module:ol/source/TileImage}
 * @param {module:ol/source/XYZ~Options=} opt_options XYZ options.
 * @api
 */
export default class XYZ extends TileImage {
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options || {};
		const projection = options.projection !== undefined ?
			options.projection : 'EPSG:3857';

		const tileGrid = options.tileGrid !== undefined ? options.tileGrid :
			createXYZ({
				extent: extentFromProjection(projection),
				maxZoom: options.maxZoom,
				minZoom: options.minZoom,
				tileSize: options.tileSize
			});

		super({
			attributions: options.attributions,
			cacheSize: options.cacheSize,
			crossOrigin: options.crossOrigin,
			opaque: options.opaque,
			projection,
			reprojectionErrorThreshold: options.reprojectionErrorThreshold,
			tileGrid,
			tileLoadFunction: options.tileLoadFunction,
			tilePixelRatio: options.tilePixelRatio,
			tileUrlFunction: options.tileUrlFunction,
			transition: options.transition,
			url: options.url,
			urls: options.urls,
			wrapX: options.wrapX !== undefined ? options.wrapX : true
		});
	}
}
