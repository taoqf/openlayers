/**
 * @module ol/source/TileImage
 */
import { listen } from '../events';
import EventType from '../events/EventType';
import ImageTile, { TileClass } from '../ImageTile';
import { getUid } from '../index';
import { equivalent, get as getProjection, ProjectionLike } from '../proj';
import Projection from '../proj/Projection';
import { ENABLE_RASTER_REPROJECTION } from '../reproj/common';
import ReprojTile from '../reproj/Tile';
import UrlTile from '../source/UrlTile';
import { LoadFunction, UrlFunction } from '../Tile';
import TileCache from '../TileCache';
import { getKey, getKeyZXY, TileCoord } from '../tilecoord';
import { getForProjection as getTileGridForProjection } from '../tilegrid';
import TileGrid from '../tilegrid/TileGrid';
import TileRange from '../TileRange';
import TileState from '../TileState';
import { AttributionLike } from './Source';
import State from './State';

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {number} [cacheSize=2048] Cache size.
 * @property {null|string} [crossOrigin] The `crossOrigin` attribute for loaded images.  Note that
 * you must provide a `crossOrigin` value if you are using the WebGL renderer or if you want to
 * access pixel data with the Canvas renderer.  See
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image} for more detail.
 * @property {boolean} [opaque=true] Whether the layer is opaque.
 * @property {module:ol/proj~ProjectionLike} projection Projection.
 * @property {number} [reprojectionErrorThreshold=0.5] Maximum allowed reprojection error (in pixels).
 * Higher values can increase reprojection performance, but decrease precision.
 * @property {module:ol/source/State} [state] Source state.
 * @property {module:ol/ImageTile~TileClass} [tileClass] Class used to instantiate image tiles.
 * Default is {@link module:ol/ImageTile~ImageTile}.
 * @property {module:ol/tilegrid/TileGrid} [tileGrid] Tile grid.
 * @property {module:ol/Tile~LoadFunction} [tileLoadFunction] Optional function to load a tile given a URL. The default is
 * ```js
 * function(imageTile, src) {
 *   imageTile.getImage().src = src;
 * };
 * ```
 * @property {number} [tilePixelRatio=1] The pixel ratio used by the tile service. For example, if the tile
 * service advertizes 256px by 256px tiles but actually sends 512px
 * by 512px images (for retina/hidpi devices) then `tilePixelRatio`
 * should be set to `2`.
 * @property {module:ol/Tile~UrlFunction} [tileUrlFunction] Optional function to get tile URL given a tile coordinate and the projection.
 * @property {string} [url] URL template. Must include `{x}`, `{y}` or `{-y}`, and `{z}` placeholders.
 * A `{?-?}` template pattern, for example `subdomain{a-f}.domain.com`, may be
 * used instead of defining each one separately in the `urls` option.
 * @property {Array.<string>} [urls] An array of URL templates.
 * @property {boolean} [wrapX] Whether to wrap the world horizontally. The default, is to
 * request out-of-bounds tiles from the server. When set to `false`, only one
 * world will be rendered. When set to `true`, tiles will be requested for one
 * world only, but they will be wrapped horizontally to render multiple worlds.
 * @property {number} [transition] Duration of the opacity transition for rendering.
 * To disable the opacity transition, pass `transition: 0`.
 */

export interface Options {
	attributions: AttributionLike;
	cacheSize: number;
	crossOrigin: null | string;
	opaque: boolean;
	projection: ProjectionLike;
	reprojectionErrorThreshold: number;
	state: State;
	tileClass: TileClass;
	tileGrid: TileGrid;
	tileLoadFunction: LoadFunction;
	tilePixelRatio: number;
	tileUrlFunction: UrlFunction;
	url: string;
	urls: string[];
	wrapX: boolean;
	transition: number;
}

/**
 * @classdesc
 * Base class for sources providing images divided into a tile grid.
 *
 * @constructor
 * @fires module:ol/source/Tile~TileSourceEvent
 * @extends {module:ol/source/UrlTile}
 * @param {module:ol/source/TileImage~Options=} options Image tile options.
 * @api
 */
export default class TileImage extends UrlTile {
	protected crossOrigin: string | null;
	protected tileClass: typeof ImageTile;
	protected tileCacheForProjection: { [tile: string]: TileCache; };
	protected tileGridForProjection: { [tile: string]: TileGrid; };
	protected reprojectionErrorThreshold_: number | undefined;
	protected renderReprojectionEdges_: boolean;
	constructor(options: Partial<Options>) {
		super({
			attributions: options.attributions,
			cacheSize: options.cacheSize,
			// extent: options.extent,
			opaque: options.opaque,
			projection: options.projection,
			state: options.state,
			tileGrid: options.tileGrid,
			tileLoadFunction: options.tileLoadFunction ?
				options.tileLoadFunction : defaultTileLoadFunction as LoadFunction,
			tilePixelRatio: options.tilePixelRatio,
			tileUrlFunction: options.tileUrlFunction,
			transition: options.transition,
			url: options.url,
			urls: options.urls,
			wrapX: options.wrapX
		});

		/**
		 * @protected
		 * @type {?string}
		 */
		this.crossOrigin =
			options.crossOrigin !== undefined ? options.crossOrigin : null;

		/**
		 * @protected
		 * @type {function(new: module:ol/ImageTile, module:ol/tilecoord~TileCoord, module:ol/TileState, string,
		 *        ?string, module:ol/Tile~LoadFunction, module:ol/Tile~Options=)}
		 */
		this.tileClass = options.tileClass !== undefined ?
			options.tileClass : ImageTile as any;

		/**
		 * @protected
		 * @type {!Object.<string, module:ol/TileCache>}
		 */
		this.tileCacheForProjection = {};

		/**
		 * @protected
		 * @type {!Object.<string, module:ol/tilegrid/TileGrid>}
		 */
		this.tileGridForProjection = {};

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.reprojectionErrorThreshold_ = options.reprojectionErrorThreshold;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.renderReprojectionEdges_ = false;
	}

	/**
	 * @inheritDoc
	 */
	public canExpireCache() {
		if (!ENABLE_RASTER_REPROJECTION) {
			return UrlTile.prototype.canExpireCache.call(this);
		}
		if (this.tileCache.canExpireCache()) {
			return true;
		} else {
			for (const key in this.tileCacheForProjection) {
				if (this.tileCacheForProjection[key].canExpireCache()) {
					return true;
				}
			}
		}
		return false;
	}


	/**
	 * @inheritDoc
	 */
	public expireCache(projection: Projection, usedTiles: { [k: string]: TileRange; }) {
		if (!ENABLE_RASTER_REPROJECTION) {
			super.expireCache(projection, usedTiles);
			return;
		}
		const usedTileCache = this.getTileCacheForProjection(projection);

		this.tileCache.expireCache(this.tileCache === usedTileCache ? usedTiles : {});
		Object.keys(this.tileCacheForProjection).forEach((id) => {
			const tileCache = this.tileCacheForProjection[id];
			tileCache.expireCache(tileCache === usedTileCache ? usedTiles : {});
		});
	}


	/**
	 * @inheritDoc
	 */
	public getGutter(projection: Projection) {
		if (ENABLE_RASTER_REPROJECTION &&
			this.getProjection() && projection && !equivalent(this.getProjection(), projection)) {
			return 0;
		} else {
			return this.getGutterInternal();
		}
	}

	/**
	 * @inheritDoc
	 */
	public getOpaque(projection: Projection) {
		if (ENABLE_RASTER_REPROJECTION &&
			this.getProjection() && projection && !equivalent(this.getProjection(), projection)) {
			return false;
		} else {
			return UrlTile.prototype.getOpaque.call(this, projection);
		}
	}


	/**
	 * @inheritDoc
	 */
	public getTileGridForProjection(projection: Projection) {
		if (!ENABLE_RASTER_REPROJECTION) {
			return UrlTile.prototype.getTileGridForProjection.call(this, projection);
		}
		const thisProj = this.getProjection();
		if (this.tileGrid && (!thisProj || equivalent(thisProj, projection))) {
			return this.tileGrid;
		} else {
			const projKey = getUid(projection).toString();
			if (!(projKey in this.tileGridForProjection)) {
				this.tileGridForProjection[projKey] = getTileGridForProjection(projection);
			}
			return (
				/** @type {!module:ol/tilegrid/TileGrid} */ (this.tileGridForProjection[projKey])
			);
		}
	}


	/**
	 * @inheritDoc
	 */
	public getTileCacheForProjection(projection: Projection) {
		if (!ENABLE_RASTER_REPROJECTION) {
			return super.getTileCacheForProjection(projection);
		}
		const thisProj = this.getProjection(); if (!thisProj || equivalent(thisProj, projection)) {
			return this.tileCache;
		} else {
			const projKey = getUid(projection).toString();
			if (!(projKey in this.tileCacheForProjection)) {
				this.tileCacheForProjection[projKey] = new TileCache(this.tileCache.highWaterMark);
			}
			return this.tileCacheForProjection[projKey];
		}
	}

	/**
	 * @inheritDoc
	 */
	public getTile(z: number, x: number, y: number, pixelRatio: number, projection: Projection) {
		const sourceProjection = /** @type {!module:ol/proj/Projection} */ (this.getProjection());
		if (!ENABLE_RASTER_REPROJECTION ||
			!sourceProjection || !projection || equivalent(sourceProjection, projection)) {
			return this.getTileInternal(z, x, y, pixelRatio, sourceProjection || projection);
		} else {
			const cache = this.getTileCacheForProjection(projection)!;
			const tileCoord = [z, x, y] as TileCoord;
			let tile;
			const tileCoordKey = getKey(tileCoord);
			if (cache.containsKey(tileCoordKey)) {
				tile = /** @type {!module:ol/Tile} */ (cache.get(tileCoordKey));
			}
			const key = this.getKey();
			if (tile && tile.key === key) {
				return tile;
			} else {
				const sourceTileGrid = this.getTileGridForProjection(sourceProjection);
				const targetTileGrid = this.getTileGridForProjection(projection);
				const wrappedTileCoord =
					this.getTileCoordForTileUrlFunction(tileCoord, projection)!;
				const newTile = new ReprojTile(
					sourceProjection, sourceTileGrid,
					projection, targetTileGrid,
					tileCoord, wrappedTileCoord, this.getTilePixelRatio(pixelRatio),
					this.getGutterInternal(),
					(zz, xx, yy, pixel_ratio) => {
						return this.getTileInternal(zz, xx, yy, pixel_ratio, sourceProjection) as any;	// todo as any
					}, this.reprojectionErrorThreshold_,
					this.renderReprojectionEdges_);
				newTile.key = key;

				if (tile) {
					newTile.interimTile = tile;
					newTile.refreshInterimChain();
					cache.replace(tileCoordKey, newTile);
				} else {
					cache.set(tileCoordKey, newTile);
				}
				return newTile;
			}
		}
	}

	/**
	 * Sets whether to render reprojection edges or not (usually for debugging).
	 * @param {boolean} render Render the edges.
	 * @api
	 */
	public setRenderReprojectionEdges(render: boolean) {
		if (!ENABLE_RASTER_REPROJECTION ||
			this.renderReprojectionEdges_ === render) {
			return;
		}
		this.renderReprojectionEdges_ = render;
		Object.keys(this.tileCacheForProjection).forEach((id) => {
			this.tileCacheForProjection[id].clear();
		});
		this.changed();
	}


	/**
	 * Sets the tile grid to use when reprojecting the tiles to the given
	 * projection instead of the default tile grid for the projection.
	 *
	 * This can be useful when the default tile grid cannot be created
	 * (e.g. projection has no extent defined) or
	 * for optimization reasons (custom tile size, resolutions, ...).
	 *
	 * @param {module:ol/proj~ProjectionLike} projection Projection.
	 * @param {module:ol/tilegrid/TileGrid} tilegrid Tile grid to use for the projection.
	 * @api
	 */
	public setTileGridForProjection(projection: ProjectionLike, tilegrid: TileGrid) {
		if (ENABLE_RASTER_REPROJECTION) {
			const proj = getProjection(projection);
			if (proj) {
				const projKey = getUid(proj).toString();
				if (!(projKey in this.tileGridForProjection)) {
					this.tileGridForProjection[projKey] = tilegrid;
				}
			}
		}
	}


	/**
	 * @param {number} z Tile coordinate z.
	 * @param {number} x Tile coordinate x.
	 * @param {number} y Tile coordinate y.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {!module:ol/proj/Projection} projection Projection.
	 * @return {!module:ol/Tile} Tile.
	 * @protected
	 */
	protected getTileInternal(z: number, x: number, y: number, pixelRatio: number, projection: Projection) {
		let tile = null;
		const tileCoordKey = getKeyZXY(z, x, y);
		const key = this.getKey();
		if (!this.tileCache.containsKey(tileCoordKey)) {
			tile = this.createTile_(z, x, y, pixelRatio, projection, key);
			this.tileCache.set(tileCoordKey, tile);
		} else {
			tile = this.tileCache.get(tileCoordKey) as ImageTile;
			if (tile.key !== key) {
				// The source's params changed. If the tile has an interim tile and if we
				// can use it then we use it. Otherwise we create a new tile.  In both
				// cases we attempt to assign an interim tile to the new tile.
				const interimTile = tile;
				tile = this.createTile_(z, x, y, pixelRatio, projection, key);

				// make the new tile the head of the list,
				if (interimTile.getState() === TileState.IDLE) {
					// the old tile hasn't begun loading yet, and is now outdated, so we can simply discard it
					tile.interimTile = interimTile.interimTile;
				} else {
					tile.interimTile = interimTile;
				}
				tile.refreshInterimChain();
				this.tileCache.replace(tileCoordKey, tile);
			}
		}
		return tile;
	}

	/**
	 * @protected
	 * @return {number} Gutter.
	 */
	protected getGutterInternal() {
		return 0;
	}


	/**
	 * @param {number} z Tile coordinate z.
	 * @param {number} x Tile coordinate x.
	 * @param {number} y Tile coordinate y.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {module:ol/proj/Projection} projection Projection.
	 * @param {string} key The key set on the tile.
	 * @return {!module:ol/Tile} Tile.
	 * @private
	 */
	private createTile_(z: number, x: number, y: number, pixelRatio: number, projection: Projection, key: string) {
		const tileCoord = [z, x, y] as TileCoord;
		const urlTileCoord = this.getTileCoordForTileUrlFunction(
			tileCoord, projection);
		const tileUrl = urlTileCoord ?
			this.tileUrlFunction(urlTileCoord, pixelRatio, projection) : undefined;
		const tile = new this.tileClass(
			tileCoord,
			tileUrl !== undefined ? TileState.IDLE : TileState.EMPTY,
			tileUrl !== undefined ? tileUrl : '',
			this.crossOrigin!,
			this.tileLoadFunction!,
			this.tileOptions);
		tile.key = key;
		listen(tile, EventType.CHANGE,
			this.handleTileChange, this);
		return tile;
	}

}

/**
 * @param {module:ol/ImageTile} imageTile Image tile.
 * @param {string} src Source.
 */
function defaultTileLoadFunction(imageTile: ImageTile, src: string) {
	(imageTile.getImage() as HTMLImageElement).src = src;
}

