/**
 * @module ol/source/VectorTile
 */
import { Extent } from '../extent';
import FeatureFormat from '../format/Feature';
import { ProjectionLike } from '../proj';
import Projection from '../proj/Projection';
import { Size, toSize } from '../size';
import UrlTile from '../source/UrlTile';
import { LoadFunction, UrlFunction } from '../Tile';
import { getKeyZXY, TileCoord } from '../tilecoord';
import { createForProjection, createXYZ, extentFromProjection } from '../tilegrid';
import TileGrid from '../tilegrid/TileGrid';
import TileState from '../TileState';
import VectorImageTile, { defaultLoadFunction } from '../VectorImageTile';
import Tile, { TileClass } from '../VectorTile';
import { AttributionLike } from './Source';
import SourceState from './State';

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {number} [cacheSize=128] Cache size.
 * @property {module:ol/format/Feature} [format] Feature format for tiles. Used and required by the default.
 * @property {boolean} [overlaps=true] This source may have overlapping geometries. Setting this
 * to `false` (e.g. for sources with polygons that represent administrative
 * boundaries or TopoJSON sources) allows the renderer to optimise fill and
 * stroke operations.
 * @property {module:ol/proj~ProjectionLike} projection Projection.
 * @property {module:ol/source/State} [state] Source state.
 * @property {module:ol/VectorTile~TileClass} [tileClass] Class used to instantiate image tiles.
 * Default is {@link module:ol/VectorTile}.
 * @property {module:ol/tilegrid/TileGrid} [tileGrid] Tile grid.
 * @property {module:ol/Tile~LoadFunction} [tileLoadFunction]
 * Optional function to load a tile given a URL. Could look like this:
 * ```js
 * function(tile, url) {
 *   tile.setLoader(function() {
 *     var data = // ... fetch data
 *     var format = tile.getFormat();
 *     tile.setProjection(format.readProjection(data));
 *     tile.setFeatures(format.readFeatures(data, {
 *       // featureProjection is not required for ol/format/MVT
 *       featureProjection: map.getView().getProjection()
 *     }));
 *     // the line below is only required for ol/format/MVT
 *     tile.setExtent(format.getLastExtent());
 *   };
 * });
 * @property {module:ol/Tile~UrlFunction} [tileUrlFunction] Optional function to get tile URL given a tile coordinate and the projection.
 * @property {string} [url] URL template. Must include `{x}`, `{y}` or `{-y}`, and `{z}` placeholders.
 * A `{?-?}` template pattern, for example `subdomain{a-f}.domain.com`, may be
 * used instead of defining each one separately in the `urls` option.
 * @property {number} [transition] A duration for tile opacity
 * transitions in milliseconds. A duration of 0 disables the opacity transition.
 * @property {Array.<string>} [urls] An array of URL templates.
 * @property {boolean} [wrapX=true] Whether to wrap the world horizontally.
 * When set to `false`, only one world
 * will be rendered. When set to `true`, tiles will be wrapped horizontally to
 * render multiple worlds.
 */

export interface Options {
	extent: Extent;
	maxZoom: number;
	minZoom: number;
	tileSize: number;
	attributions: AttributionLike;
	cacheSize: number;
	format: FeatureFormat;
	overlaps: boolean;
	projection: ProjectionLike;
	state: SourceState;
	tileClass: TileClass;
	tileGrid: TileGrid;
	tileLoadFunction: LoadFunction;
	tileUrlFunction: UrlFunction;
	url: string;
	transition: number;
	urls: string[];
	wrapX: boolean;
}

/**
 * @classdesc
 * Class for layer sources providing vector data divided into a tile grid, to be
 * used with {@link module:ol/layer/VectorTile~VectorTile}. Although this source receives tiles
 * with vector features from the server, it is not meant for feature editing.
 * Features are optimized for rendering, their geometries are clipped at or near
 * tile boundaries and simplified for a view resolution. See
 * {@link module:ol/source/Vector} for vector sources that are suitable for feature
 * editing.
 *
 * @constructor
 * @fires module:ol/source/Tile~TileSourceEvent
 * @extends {module:ol/source/UrlTile}
 * @param {module:ol/source/VectorTile~Options=} options Vector tile options.
 * @api
 */
export default class VectorTile extends UrlTile {
	public tileClass: TileClass | typeof Tile;
	private format_: FeatureFormat | null;
	private sourceTiles_: { [s: string]: Tile; };
	private overlaps_: boolean;
	private tileGrids_: { [s: string]: TileGrid; };
	constructor(options: Partial<Options>) {
		const projection = options.projection || 'EPSG:3857';

		const extent = options.extent || extentFromProjection(projection);

		const tileGrid = options.tileGrid || createXYZ({
			extent,
			maxZoom: options.maxZoom || 22,
			minZoom: options.minZoom,
			tileSize: options.tileSize || 512
		});

		super({
			attributions: options.attributions,
			cacheSize: options.cacheSize !== undefined ? options.cacheSize : 128,
			extent,
			opaque: false,
			projection,
			state: options.state,
			tileGrid,
			tileLoadFunction: options.tileLoadFunction ? options.tileLoadFunction : defaultLoadFunction as LoadFunction,
			tileUrlFunction: options.tileUrlFunction,
			transition: options.transition,
			url: options.url,
			urls: options.urls,
			wrapX: options.wrapX === undefined ? true : options.wrapX
		});

		/**
		 * @private
		 * @type {module:ol/format/Feature}
		 */
		this.format_ = options.format ? options.format : null;

		/**
		 * @private
		 * @type {Object.<string, module:ol/VectorTile>}
		 */
		this.sourceTiles_ = {};

		/**
		 * @private
		 * @type {boolean}
		 */
		this.overlaps_ = options.overlaps === undefined ? true : options.overlaps;

		/**
		 * @protected
		 * @type {function(new: module:ol/VectorTile, module:ol/tilecoord~TileCoord, module:ol/TileState, string,
		 *        module:ol/format/Feature, module:ol/Tile~LoadFunction)}
		 */
		this.tileClass = options.tileClass ? options.tileClass : Tile;

		/**
		 * @private
		 * @type {Object.<string, module:ol/tilegrid/TileGrid>}
		 */
		this.tileGrids_ = {};

	}

	/**
	 * @return {boolean} The source can have overlapping geometries.
	 */
	public getOverlaps() {
		return this.overlaps_;
	}

	/**
	 * clear {@link module:ol/TileCache~TileCache} and delete all source tiles
	 * @api
	 */
	public clear() {
		this.tileCache.clear();
		this.sourceTiles_ = {};
	}

	/**
	 * @inheritDoc
	 */
	public getTile(z: number, x: number, y: number, pixelRatio: number, projection: Projection) {
		const tileCoordKey = getKeyZXY(z, x, y);
		if (this.tileCache.containsKey(tileCoordKey)) {
			return (
			/** @type {!module:ol/Tile} */ (this.tileCache.get(tileCoordKey))
			);
		} else {
			const tileCoord = [z, x, y] as TileCoord;
			const urlTileCoord = this.getTileCoordForTileUrlFunction(
				tileCoord, projection);
			const tile = new VectorImageTile(
				tileCoord,
				urlTileCoord !== null ? TileState.IDLE : TileState.EMPTY,
				this.getRevision(),
				this.format_!, this.tileLoadFunction!, urlTileCoord!, this.tileUrlFunction,
				this.tileGrid!, this.getTileGridForProjection(projection),
				this.sourceTiles_, pixelRatio, projection, this.tileClass as any,	// todo TileClass is not compatable
				this.handleTileChange.bind(this), tileCoord[0]);

			this.tileCache.set(tileCoordKey, tile);
			return tile;
		}
	}


	/**
	 * @inheritDoc
	 */
	public getTileGridForProjection(projection: Projection) {
		const code = projection.getCode();
		let tileGrid = this.tileGrids_[code];
		if (!tileGrid) {
			// A tile grid that matches the tile size of the source tile grid is more
			// likely to have 1:1 relationships between source tiles and rendered tiles.
			const sourceTileGrid = this.tileGrid;
			tileGrid = this.tileGrids_[code] = createForProjection(projection, undefined,
				sourceTileGrid ? sourceTileGrid.getTileSize(sourceTileGrid.getMinZoom()) as Size : undefined);
		}
		return tileGrid;
	}


	/**
	 * @inheritDoc
	 */
	public getTilePixelRatio(pixelRatio: number) {
		return pixelRatio;
	}


	/**
	 * @inheritDoc
	 */
	public getTilePixelSize(z: number, pixelRatio: number, projection: Projection) {
		const tileGrid = this.getTileGridForProjection(projection);
		const tileSize = toSize(tileGrid.getTileSize(z), this.tmpSize);
		return [Math.round(tileSize[0] * pixelRatio), Math.round(tileSize[1] * pixelRatio)] as Size;
	}
}
