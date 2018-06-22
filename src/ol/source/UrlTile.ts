/**
 * @module ol/source/UrlTile
 */
import Event from '../events/Event';
import { Extent } from '../extent';
import { getUid } from '../index';
import { ProjectionLike } from '../proj';
import Projection from '../proj/Projection';
import TileSource, { TileSourceEvent } from '../source/Tile';
import TileEventType from '../source/TileEventType';
import { LoadFunction, UrlFunction } from '../Tile';
import { getKeyZXY, TileCoord } from '../tilecoord';
import TileGrid from '../tilegrid/TileGrid';
import TileState from '../TileState';
import { createFromTemplates, expandUrl, nullTileUrlFunction } from '../tileurlfunction';
import { AttributionLike } from './Source';
import State from './State';

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions]
 * @property {number} [cacheSize]
 * @property {module:ol/extent~Extent} [extent]
 * @property {boolean} [opaque]
 * @property {module:ol/proj~ProjectionLike} [projection]
 * @property {module:ol/source/State} [state]
 * @property {module:ol/tilegrid/TileGrid} [tileGrid]
 * @property {module:ol/Tile~LoadFunction} tileLoadFunction
 * @property {number} [tilePixelRatio]
 * @property {module:ol/Tile~UrlFunction} [tileUrlFunction]
 * @property {string} [url]
 * @property {Array.<string>} [urls]
 * @property {boolean} [wrapX=true]
 * @property {number} [transition]
 */

export interface Options {
	attributions: AttributionLike;
	cacheSize: number;
	extent: Extent;	// todo do we need this?
	opaque: boolean;
	projection: ProjectionLike;
	state: State;
	tileGrid: TileGrid;
	tileLoadFunction: LoadFunction;
	tilePixelRatio: number;
	tileUrlFunction: UrlFunction;
	string: string;
	url: string;
	urls: string[];
	wrapX: boolean;
	transition: number;
}

/**
 * @classdesc
 * Base class for sources providing tiles divided into a tile grid over http.
 *
 * @constructor
 * @abstract
 * @fires module:ol/source/TileEvent
 * @extends {module:ol/source/Tile}
 * @param {module:ol/source/UrlTile~Options=} options Image tile options.
 */
export default abstract class UrlTile extends TileSource {
	protected tileLoadFunction: LoadFunction | undefined;
	protected tileUrlFunction: UrlFunction;
	protected urls: string[] | null;
	protected tileLoadingKeys_: { [k: number]: boolean; };
	constructor(options: Partial<Options>) {
		super({
			attributions: options.attributions,
			cacheSize: options.cacheSize,
			// extent: options.extent,
			opaque: options.opaque,
			projection: options.projection,
			state: options.state,
			tileGrid: options.tileGrid,
			tilePixelRatio: options.tilePixelRatio,
			transition: options.transition,
			wrapX: options.wrapX
		});

		/**
		 * @protected
		 * @type {module:ol/Tile~LoadFunction}
		 */
		this.tileLoadFunction = options.tileLoadFunction;

		/**
		 * @protected
		 * @type {module:ol/Tile~UrlFunction}
		 */
		this.tileUrlFunction = this.fixedTileUrlFunction ?
			this.fixedTileUrlFunction.bind(this) : nullTileUrlFunction;

		/**
		 * @protected
		 * @type {!Array.<string>|null}
		 */
		this.urls = null;

		if (options.urls) {
			this.setUrls(options.urls);
		} else if (options.url) {
			this.setUrl(options.url);
		}
		if (options.tileUrlFunction) {
			this.setTileUrlFunction(options.tileUrlFunction);
		}

		/**
		 * @private
		 * @type {!Object.<number, boolean>}
		 */
		this.tileLoadingKeys_ = {};

	}


	/**
	 * Return the tile load function of the source.
	 * @return {module:ol/Tile~LoadFunction} TileLoadFunction
	 * @api
	 */
	public getTileLoadFunction() {
		return this.tileLoadFunction;
	}


	/**
	 * Return the tile URL function of the source.
	 * @return {module:ol/Tile~UrlFunction} TileUrlFunction
	 * @api
	 */
	public getTileUrlFunction() {
		return this.tileUrlFunction;
	}


	/**
	 * Return the URLs used for this source.
	 * When a tileUrlFunction is used instead of url or urls,
	 * null will be returned.
	 * @return {!Array.<string>|null} URLs.
	 * @api
	 */
	public getUrls() {
		return this.urls;
	}

	/**
	 * Set the tile load function of the source.
	 * @param {module:ol/Tile~LoadFunction} tileLoadFunction Tile load function.
	 * @api
	 */
	public setTileLoadFunction(tileLoadFunction: LoadFunction) {
		this.tileCache.clear();
		this.tileLoadFunction = tileLoadFunction;
		this.changed();
	}


	/**
	 * Set the tile URL function of the source.
	 * @param {module:ol/Tile~UrlFunction} tileUrlFunction Tile URL function.
	 * @param {string=} opt_key Optional new tile key for the source.
	 * @api
	 */
	public setTileUrlFunction(tileUrlFunction: UrlFunction, opt_key?: string) {
		this.tileUrlFunction = tileUrlFunction;
		this.tileCache.pruneExceptNewestZ();
		if (typeof opt_key !== 'undefined') {
			this.setKey(opt_key);
		} else {
			this.changed();
		}
	}

	/**
	 * Set the URL to use for requests.
	 * @param {string} url URL.
	 * @api
	 */
	public setUrl(url: string) {
		const urls = this.urls = expandUrl(url);
		this.setTileUrlFunction(this.fixedTileUrlFunction ?
			this.fixedTileUrlFunction.bind(this) :
			createFromTemplates(urls, this.tileGrid), url);
	}


	/**
	 * Set the URLs to use for requests.
	 * @param {Array.<string>} urls URLs.
	 * @api
	 */
	public setUrls(urls: string[]) {
		this.urls = urls;
		const key = urls.join('\n');
		this.setTileUrlFunction(this.fixedTileUrlFunction ?
			this.fixedTileUrlFunction.bind(this) :
			createFromTemplates(urls, this.tileGrid), key);
	}


	/**
	 * @inheritDoc
	 */
	public useTile(z: number, x: number, y: number) {
		const tileCoordKey = getKeyZXY(z, x, y);
		if (this.tileCache.containsKey(tileCoordKey)) {
			this.tileCache.get(tileCoordKey);
		}
	}

	/**
	 * @type {module:ol/Tile~UrlFunction|undefined}
	 * @protected
	 */
	protected fixedTileUrlFunction(_tileCoord: TileCoord, _pixelRatio: number, _projection: Projection) {
	}


	/**
	 * Handle tile change events.
	 * @param {module:ol/events/Event} event Event.
	 * @protected
	 */
	protected handleTileChange(event: Event) {
		const tile = /** @type {module:ol/Tile} */ (event.target);
		const uid = getUid(tile);
		const tileState = tile.getState();
		let type;
		if (tileState === TileState.LOADING) {
			this.tileLoadingKeys_[uid] = true;
			type = TileEventType.TILELOADSTART;
		} else if (uid in this.tileLoadingKeys_) {
			delete this.tileLoadingKeys_[uid];
			type = tileState === TileState.ERROR ? TileEventType.TILELOADERROR :
				(tileState === TileState.LOADED || tileState === TileState.ABORT) ?
					TileEventType.TILELOADEND : undefined;
		}
		if (type !== undefined) {
			this.dispatchEvent(new TileSourceEvent(type, tile));
		}
	}
}
