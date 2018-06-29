import { EventsKey } from '../events';
import Event from '../events/Event';
import ImageState from '../ImageState';
import { Size } from '../size';

/**
 * @module ol/style/Image
 */

/**
 * @typedef {Object} Options
 * @property {number} opacity
 * @property {boolean} rotateWithView
 * @property {number} rotation
 * @property {number} scale
 * @property {boolean} snapToPixel
 */

export interface Options {
	opacity: number;
	rotateWithView: boolean;
	rotation: number;
	scale: number;
	snapToPixel: boolean;
}

/**
 * @classdesc
 * A base class used for creating subclasses and not instantiated in
 * apps. Base class for {@link module:ol/style/Icon~Icon}, {@link module:ol/style/Circle~CircleStyle} and
 * {@link module:ol/style/RegularShape~RegularShape}.
 *
 * @constructor
 * @abstract
 * @param {module:ol/style/Image~Options} options Options.
 * @api
 */
export default abstract class ImageStyle {
	private opacity: number;
	private rotateWithView: boolean;
	private rotation: number;
	private scale: number;
	private snapToPixel: boolean;
	constructor(options: Options) {

		/**
		 * @private
		 * @type {number}
		 */
		this.opacity = options.opacity;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.rotateWithView = options.rotateWithView;

		/**
		 * @private
		 * @type {number}
		 */
		this.rotation = options.rotation;

		/**
		 * @private
		 * @type {number}
		 */
		this.scale = options.scale;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.snapToPixel = options.snapToPixel;

	}


	/**
	 * Get the symbolizer opacity.
	 * @return {number} Opacity.
	 * @api
	 */
	public getOpacity() {
		return this.opacity;
	}


	/**
	 * Determine whether the symbolizer rotates with the map.
	 * @return {boolean} Rotate with map.
	 * @api
	 */
	public getRotateWithView() {
		return this.rotateWithView;
	}


	/**
	 * Get the symoblizer rotation.
	 * @return {number} Rotation.
	 * @api
	 */
	public getRotation() {
		return this.rotation;
	}


	/**
	 * Get the symbolizer scale.
	 * @return {number} Scale.
	 * @api
	 */
	public getScale() {
		return this.scale;
	}


	/**
	 * Determine whether the symbolizer should be snapped to a pixel.
	 * @return {boolean} The symbolizer should snap to a pixel.
	 * @api
	 */
	public getSnapToPixel() {
		return this.snapToPixel;
	}


	/**
	 * Get the anchor point in pixels. The anchor determines the center point for the
	 * symbolizer.
	 * @abstract
	 * @return {Array.<number>} Anchor.
	 */
	public abstract getAnchor(): number[] | null;


	/**
	 * Get the image element for the symbolizer.
	 * @abstract
	 * @param {number} pixelRatio Pixel ratio.
	 * @return {HTMLCanvasElement|HTMLVideoElement|Image} Image element.
	 */
	public abstract getImage(pixelRatio: number): HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;


	/**
	 * @abstract
	 * @param {number} pixelRatio Pixel ratio.
	 * @return {HTMLCanvasElement|HTMLVideoElement|Image} Image element.
	 */
	public abstract getHitDetectionImage(pixelRatio: number): HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;


	/**
	 * @abstract
	 * @return {module:ol/ImageState} Image state.
	 */
	public abstract getImageState(): ImageState;


	/**
	 * @abstract
	 * @return {module:ol/size~Size} Image size.
	 */
	public abstract getImageSize(): Size | null;


	/**
	 * @abstract
	 * @return {module:ol/size~Size} Size of the hit-detection image.
	 */
	public abstract getHitDetectionImageSize(): Size | null;


	/**
	 * Get the origin of the symbolizer.
	 * @abstract
	 * @return {Array.<number>} Origin.
	 */
	public abstract getOrigin(): number[] | null;


	/**
	 * Get the size of the symbolizer (in pixels).
	 * @abstract
	 * @return {module:ol/size~Size} Size.
	 */
	public abstract getSize(): Size | null;


	/**
	 * Set the opacity.
	 *
	 * @param {number} opacity Opacity.
	 * @api
	 */
	public setOpacity(opacity: number) {
		this.opacity = opacity;
	}


	/**
	 * Set whether to rotate the style with the view.
	 *
	 * @param {boolean} rotateWithView Rotate with map.
	 * @api
	 */
	public setRotateWithView(rotateWithView: boolean) {
		this.rotateWithView = rotateWithView;
	}


	/**
	 * Set the rotation.
	 *
	 * @param {number} rotation Rotation.
	 * @api
	 */
	public setRotation(rotation: number) {
		this.rotation = rotation;
	}


	/**
	 * Set the scale.
	 *
	 * @param {number} scale Scale.
	 * @api
	 */
	public setScale(scale: number) {
		this.scale = scale;
	}


	/**
	 * Set whether to snap the image to the closest pixel.
	 *
	 * @param {boolean} snapToPixel Snap to pixel?
	 * @api
	 */
	public setSnapToPixel(snapToPixel: boolean) {
		this.snapToPixel = snapToPixel;
	}


	/**
	 * @abstract
	 * @param {function(this: T, module:ol/events/Event)} listener Listener function.
	 * @param {T} thisArg Value to use as `this` when executing `listener`.
	 * @return {module:ol/events~EventsKey|undefined} Listener key.
	 * @template T
	 */
	public abstract listenImageChange<T>(listener: (this: T, e: Event) => void, thisArg: T): EventsKey | undefined | void;


	/**
	 * Load not yet loaded URI.
	 * @abstract
	 */
	public abstract load(): void;


	/**
	 * @abstract
	 * @param {function(this: T, module:ol/events/Event)} listener Listener function.
	 * @param {T} thisArg Value to use as `this` when executing `listener`.
	 * @template T
	 */
	public abstract unlistenImageChange<T>(listener: (this: T, e: Event) => void, thisArg: T): void;
}
