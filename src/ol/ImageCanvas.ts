/**
 * @module ol/ImageCanvas
 */
import { Extent } from './extent';
import ImageBase from './ImageBase';
import ImageState from './ImageState';

/**
 * A function that is called to trigger asynchronous canvas drawing.  It is
 * called with a "done" callback that should be called when drawing is done.
 * If any error occurs during drawing, the "done" callback should be called with
 * that error.
 *
 * @typedef {function(function(Error))} Loader
 */
export type Loader = (callback: (e: Error) => void) => void;

/**
 * @constructor
 * @extends {module:ol/ImageBase}
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {HTMLCanvasElement} canvas Canvas.
 * @param {module:ol/ImageCanvas~Loader=} opt_loader Optional loader function to
 *     support asynchronous canvas drawing.
 */
export default class ImageCanvas extends ImageBase {
	private loader_: Loader;
	private canvas_: HTMLCanvasElement;
	private error_: Error | null;
	constructor(extent: Extent, resolution: number, pixelRatio: number, canvas: HTMLCanvasElement, opt_loader?: Loader) {
		super(extent, resolution, pixelRatio, opt_loader !== undefined ? ImageState.IDLE : ImageState.LOADED);
		/**
		 * Optional canvas loader function.
		 * @type {?module:ol/ImageCanvas~Loader}
		 * @private
		 */
		this.loader_ = opt_loader !== undefined ? opt_loader : null;

		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas_ = canvas;

		/**
		 * @private
		 * @type {Error}
		 */
		this.error_ = null;

	}

	/**
	 * Get any error associated with asynchronous rendering.
	 * @return {Error} Any error that occurred during rendering.
	 */
	public getError() {
		return this.error_;
	}

	/**
	 * @inheritDoc
	 */
	public load() {
		if (this.state === ImageState.IDLE) {
			this.state = ImageState.LOADING;
			this.changed();
			this.loader_(this.handleLoad_.bind(this));
		}
	}


	/**
	 * @return {HTMLCanvasElement} Canvas element.
	 */
	public getImage() {
		return this.canvas_;
	}

	/**
	 * Handle async drawing complete.
	 * @param {Error} err Any error during drawing.
	 * @private
	 */
	private handleLoad_(err: Error) {
		if (err) {
			this.error_ = err;
			this.state = ImageState.ERROR;
		} else {
			this.state = ImageState.LOADED;
		}
		this.changed();
	}
}
