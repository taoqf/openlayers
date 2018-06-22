/**
 * @module ol/ImageBase
 */
import EventTarget from './events/EventTarget';
import EventType from './events/EventType';
import { Extent } from './extent';
import Image from './Image';
import ImageState from './ImageState';

/**
 * @constructor
 * @abstract
 * @extends {module:ol/events/EventTarget}
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number|undefined} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {module:ol/ImageState} state State.
 */
export default abstract class ImageBase extends EventTarget {
	public extent: Extent;
	public resolution: number | undefined;
	public state: ImageState;
	private pixelRatio: number | undefined;
	constructor(extent: Extent, resolution: number | undefined, pixelRatio: number | undefined, state: ImageState) {
		super();

		/**
		 * @protected
		 * @type {module:ol/extent~Extent}
		 */
		this.extent = extent;

		/**
		 * @private
		 * @type {number}
		 */
		this.pixelRatio = pixelRatio;

		/**
		 * @protected
		 * @type {number|undefined}
		 */
		this.resolution = resolution;

		/**
		 * @protected
		 * @type {module:ol/ImageState}
		 */
		this.state = state;

	}

	/**
	 * @abstract
	 * @return {HTMLCanvasElement|Image|HTMLVideoElement} Image.
	 */
	public abstract getImage(): HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | null;


	/**
	 * Load not yet loaded URI.
	 * @abstract
	 */
	public abstract load(): void;

	/**
	 * @return {module:ol/extent~Extent} Extent.
	 */
	public getExtent() {
		return this.extent;
	}

	/**
	 * @return {number} PixelRatio.
	 */
	public getPixelRatio() {
		return this.pixelRatio;
	}


	/**
	 * @return {number} Resolution.
	 */
	public getResolution() {
		return /** @type {number} */ (this.resolution);
	}


	/**
	 * @return {module:ol/ImageState} State.
	 */
	public getState() {
		return this.state;
	}

	/**
	 * @protected
	 */
	protected changed() {
		this.dispatchEvent(EventType.CHANGE);
	}
}
