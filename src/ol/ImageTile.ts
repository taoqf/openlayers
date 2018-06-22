/**
 * @module ol/ImageTile
 */
import { createCanvasContext2D } from './dom';
import { EventsKey, listenOnce, unlistenByKey } from './events';
import EventType from './events/EventType';
import Tile, { LoadFunction, Options as TileOptions } from './Tile';
import { TileCoord } from './tilecoord';
import TileState from './TileState';

/**
 * @typedef {function(new: module:ol/ImageTile, module:ol/tilecoord~TileCoord,
 * module:ol/TileState, string, ?string, module:ol/Tile~LoadFunction)} TileClass
 * @api
 */

export type TileClass = (imageTile: ImageTile, tilecoord: TileCoord, tileState: TileState, s1: string, s2: string, loadFun: LoadFunction) => void;



/**
 * Get a 1-pixel blank image.
 * @return {HTMLCanvasElement} Blank image.
 */
function getBlankImage() {
	const ctx = createCanvasContext2D(1, 1)!;
	ctx.fillStyle = 'rgba(0,0,0,0)';
	ctx.fillRect(0, 0, 1, 1);
	return ctx.canvas;
}

/**
 * @constructor
 * @extends {module:ol/Tile}
 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
 * @param {module:ol/TileState} state State.
 * @param {string} src Image source URI.
 * @param {?string} crossOrigin Cross origin.
 * @param {module:ol/Tile~LoadFunction} tileLoadFunction Tile load function.
 * @param {module:ol/Tile~Options=} opt_options Tile options.
 */
export default class ImageTile extends Tile {
	private crossOrigin_: string;
	private src_: string;
	private image_: HTMLImageElement | HTMLCanvasElement;
	private imageListenerKeys_: EventsKey[] | null;
	private tileLoadFunction_: LoadFunction;
	constructor(tileCoord: TileCoord, state: TileState, src: string, crossOrigin: string, tileLoadFunction: LoadFunction, opt_options?: Partial<TileOptions>) {

		super(tileCoord, state, opt_options);

		/**
		 * @private
		 * @type {?string}
		 */
		this.crossOrigin_ = crossOrigin;

		/**
		 * Image URI
		 *
		 * @private
		 * @type {string}
		 */
		this.src_ = src;

		/**
		 * @private
		 * @type {Image|HTMLCanvasElement}
		 */
		this.image_ = new Image();
		if (crossOrigin !== null) {
			this.image_.crossOrigin = crossOrigin;
		}

		/**
		 * @private
		 * @type {Array.<module:ol/events~EventsKey>}
		 */
		this.imageListenerKeys_ = null;

		/**
		 * @private
		 * @type {module:ol/Tile~LoadFunction}
		 */
		this.tileLoadFunction_ = tileLoadFunction;

	}

	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		if (this.state === TileState.LOADING) {
			this.unlistenImage_();
			this.image_ = getBlankImage();
		}
		if (this.interimTile) {
			this.interimTile.dispose();
		}
		this.state = TileState.ABORT;
		this.changed();
		Tile.prototype.disposeInternal.call(this);
	}


	/**
	 * Get the HTML image element for this tile (may be a Canvas, Image, or Video).
	 * @return {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} Image.
	 * @api
	 */
	public getImage() {
		return this.image_;
	}


	/**
	 * @inheritDoc
	 */
	public getKey() {
		return this.src_;
	}

	/**
	 * @inheritDoc
	 * @api
	 */
	public load() {
		if (this.state === TileState.ERROR) {
			this.state = TileState.IDLE;
			this.image_ = new Image();
			if (this.crossOrigin_ !== null) {
				this.image_.crossOrigin = this.crossOrigin_;
			}
		}
		if (this.state === TileState.IDLE) {
			this.state = TileState.LOADING;
			this.changed();
			this.imageListenerKeys_ = [
				listenOnce(this.image_, EventType.ERROR,
					this.handleImageError_, this)!,
				listenOnce(this.image_, EventType.LOAD,
					this.handleImageLoad_, this)!
			];
			this.tileLoadFunction_(this, this.src_);
		}
	}


	/**
	 * Tracks loading or read errors.
	 *
	 * @private
	 */
	private handleImageError_() {
		this.state = TileState.ERROR;
		this.unlistenImage_();
		this.image_ = getBlankImage();
		this.changed();
	}

	/**
	 * Discards event handlers which listen for load completion or errors.
	 *
	 * @private
	 */
	private unlistenImage_() {
		this.imageListenerKeys_!.forEach(unlistenByKey);
		this.imageListenerKeys_ = null;
	}

	/**
	 * Tracks successful image load.
	 *
	 * @private
	 */
	private handleImageLoad_() {
		if ((this.image_ as HTMLImageElement).naturalWidth && (this.image_ as HTMLImageElement).naturalHeight) {
			this.state = TileState.LOADED;
		} else {
			this.state = TileState.EMPTY;
		}
		this.unlistenImage_();
		this.changed();
	}

}
