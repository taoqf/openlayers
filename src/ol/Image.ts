/**
 * @module ol/Image
 */
import { EventsKey, listenOnce, unlistenByKey } from './events';
import EventType from './events/EventType';
import { Extent, getHeight } from './extent';
import ImageBase from './ImageBase';
import ImageState from './ImageState';


/**
 * A function that takes an {@link module:ol/Image~Image} for the image and a
 * `{string}` for the src as arguments. It is supposed to make it so the
 * underlying image {@link module:ol/Image~Image#getImage} is assigned the
 * content specified by the src. If not specified, the default is
 *
 *     function(image, src) {
 *       image.getImage().src = src;
 *     }
 *
 * Providing a custom `imageLoadFunction` can be useful to load images with
 * post requests or - in general - through XHR requests, where the src of the
 * image element would be set to a data URI when the content is loaded.
 *
 * @typedef {function(module:ol/Image, string)} LoadFunction
 * @api
 */

export type LoadFunction = (img: ImageWrapper, s: string) => void;

/**
 * @constructor
 * @extends {module:ol/ImageBase}
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number|undefined} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {string} src Image source URI.
 * @param {?string} crossOrigin Cross origin.
 * @param {module:ol/Image~LoadFunction} imageLoadFunction Image load function.
 */
export default class ImageWrapper extends ImageBase {
	private src: string;
	private image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;
	private imageListenerKeys: EventsKey[] | null;
	private imageLoadFunction: LoadFunction;
	constructor(extent: Extent, resolution: number | undefined, pixelRatio: number, src: string, crossOrigin: string | null, imageLoadFunction: LoadFunction) {

		super(extent, resolution, pixelRatio, ImageState.IDLE);

		/**
		 * @private
		 * @type {string}
		 */
		this.src = src;

		/**
		 * @private
		 * @type {HTMLCanvasElement|Image|HTMLVideoElement}
		 */
		this.image = new Image();
		if (crossOrigin !== null && crossOrigin !== undefined) {
			this.image.crossOrigin = crossOrigin;
		}

		/**
		 * @private
		 * @type {Array.<module:ol/events~EventsKey>}
		 */
		this.imageListenerKeys = null;

		/**
		 * @protected
		 * @type {module:ol/ImageState}
		 */
		this.state = ImageState.IDLE;

		/**
		 * @private
		 * @type {module:ol/Image~LoadFunction}
		 */
		this.imageLoadFunction = imageLoadFunction;

	}

	/**
	 * @inheritDoc
	 * @api
	 */
	public getImage() {
		return this.image;
	}

	/**
	 * Load the image or retry if loading previously failed.
	 * Loading is taken care of by the tile queue, and calling this method is
	 * only needed for preloading or for reloading in case of an error.
	 * @override
	 * @api
	 */
	public load() {
		if (this.state === ImageState.IDLE || this.state === ImageState.ERROR) {
			this.state = ImageState.LOADING;
			this.changed();
			this.imageListenerKeys = [
				listenOnce(this.image, EventType.ERROR,
					this.handleImageError_, this)!,
				listenOnce(this.image, EventType.LOAD,
					this.handleImageLoad_, this)!
			];
			this.imageLoadFunction(this, this.src);
		}
	}

	/**
	 * @param {HTMLCanvasElement|Image|HTMLVideoElement} image Image.
	 */
	public setImage(image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement) {
		this.image = image;
	}


	/**
	 * Discards event handlers which listen for load completion or errors.
	 *
	 * @private
	 */
	private unlistenImage_() {
		this.imageListenerKeys!.forEach(unlistenByKey);
		this.imageListenerKeys = null;
	}


	/**
	 * Tracks loading or read errors.
	 *
	 * @private
	 */
	private handleImageError_() {
		this.state = ImageState.ERROR;
		this.unlistenImage_();
		this.changed();
	}


	/**
	 * Tracks successful image load.
	 *
	 * @private
	 */
	private handleImageLoad_() {
		if (this.resolution === undefined) {
			this.resolution = getHeight(this.extent) / this.image.height;
		}
		this.state = ImageState.LOADED;
		this.unlistenImage_();
		this.changed();
	}
}
