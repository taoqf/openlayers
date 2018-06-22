/**
 * @module ol/style/IconImage
 */
import { Color } from '../color';
import { createCanvasContext2D } from '../dom';
import { EventsKey, listenOnce, unlistenByKey } from '../events';
import EventTarget from '../events/EventTarget';
import EventType from '../events/EventType';
import ImageState from '../ImageState';
import { Size } from '../size';
import { shared as iconImageCache } from '../style/IconImageCache';

/**
 * @constructor
 * @param {Image|HTMLCanvasElement} image Image.
 * @param {string|undefined} src Src.
 * @param {module:ol/size~Size} size Size.
 * @param {?string} crossOrigin Cross origin.
 * @param {module:ol/ImageState} imageState Image state.
 * @param {module:ol/color~Color} color Color.
 * @extends {module:ol/events/EventTarget}
 */
export default class IconImage extends EventTarget {
	private hitDetectionImage_: HTMLCanvasElement | HTMLImageElement | null;
	private image_: HTMLCanvasElement | HTMLImageElement;
	private canvas_: HTMLCanvasElement | null;
	private color_: Color;
	private imageListenerKeys_: EventsKey[] | null;
	private imageState_: ImageState;
	private size_: Size;
	private src_: string | undefined;
	private tainting_: boolean;
	constructor(image: HTMLCanvasElement | HTMLImageElement, src: string | undefined, size: Size, crossOrigin: string, imageState: ImageState, color: Color) {
		super();

		/**
		 * @private
		 * @type {Image|HTMLCanvasElement}
		 */
		this.hitDetectionImage_ = null;

		/**
		 * @private
		 * @type {Image|HTMLCanvasElement}
		 */
		this.image_ = !image ? new Image() : image;

		if (crossOrigin !== null) {
			(this.image_ as HTMLImageElement).crossOrigin = crossOrigin;
		}

		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas_ = color ?
	/** @type {HTMLCanvasElement} */ (document.createElement('canvas')) :
			null;

		/**
		 * @private
		 * @type {module:ol/color~Color}
		 */
		this.color_ = color;

		/**
		 * @private
		 * @type {Array.<module:ol/events~EventsKey>}
		 */
		this.imageListenerKeys_ = null;

		/**
		 * @private
		 * @type {module:ol/ImageState}
		 */
		this.imageState_ = imageState;

		/**
		 * @private
		 * @type {module:ol/size~Size}
		 */
		this.size_ = size;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.src_ = src;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.tainting_ = false;
		if (this.imageState_ === ImageState.LOADED) {
			this.determineTainting_();
		}

	}

	/**
	 * @param {number} pixelRatio Pixel ratio.
	 * @return {Image|HTMLCanvasElement} Image or Canvas element.
	 */
	public getImage(_pixelRatio: number) {
		return this.canvas_ ? this.canvas_ : this.image_;
	}


	/**
	 * @return {module:ol/ImageState} Image state.
	 */
	public getImageState() {
		return this.imageState_;
	}


	/**
	 * @param {number} pixelRatio Pixel ratio.
	 * @return {Image|HTMLCanvasElement} Image element.
	 */
	public getHitDetectionImage(_pixelRatio: number) {
		if (!this.hitDetectionImage_) {
			if (this.tainting_) {
				const width = this.size_[0];
				const height = this.size_[1];
				const context = createCanvasContext2D(width, height)!;
				context.fillRect(0, 0, width, height);
				this.hitDetectionImage_ = context.canvas;
			} else {
				this.hitDetectionImage_ = this.image_;
			}
		}
		return this.hitDetectionImage_;
	}


	/**
	 * @return {module:ol/size~Size} Image size.
	 */
	public getSize() {
		return this.size_;
	}


	/**
	 * @return {string|undefined} Image src.
	 */
	public getSrc() {
		return this.src_;
	}


	/**
	 * Load not yet loaded URI.
	 */
	public load() {
		if (this.imageState_ === ImageState.IDLE) {
			this.imageState_ = ImageState.LOADING;
			this.imageListenerKeys_ = [
				listenOnce(this.image_, EventType.ERROR,
					this.handleImageError_, this),
				listenOnce(this.image_, EventType.LOAD,
					this.handleImageLoad_, this)
			] as EventsKey[];
			try {
				(this.image_ as HTMLImageElement).src = this.src_!;
			} catch (e) {
				this.handleImageError_();
			}
		}
	}


	/**
	 * @private
	 */
	private replaceColor_() {
		if (this.tainting_ || this.color_ === null) {
			return;
		}

		this.canvas_!.width = this.image_.width;
		this.canvas_!.height = this.image_.height;

		const ctx = this.canvas_!.getContext('2d')!;
		ctx.drawImage(this.image_, 0, 0);

		const imgData = ctx.getImageData(0, 0, this.image_.width, this.image_.height);
		const data = imgData.data;
		const r = this.color_[0] / 255.0;
		const g = this.color_[1] / 255.0;
		const b = this.color_[2] / 255.0;

		for (let i = 0, ii = data.length; i < ii; i += 4) {
			data[i] *= r;
			data[i + 1] *= g;
			data[i + 2] *= b;
		}
		ctx.putImageData(imgData, 0, 0);
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
	 * @private
	 */
	private determineTainting_() {
		const context = createCanvasContext2D(1, 1);
		try {
			context!.drawImage(this.image_, 0, 0);
			context!.getImageData(0, 0, 1, 1);
		} catch (e) {
			this.tainting_ = true;
		}
	}


	/**
	 * @private
	 */
	private dispatchChangeEvent_() {
		this.dispatchEvent(EventType.CHANGE);
	}


	/**
	 * @private
	 */
	private handleImageError_() {
		this.imageState_ = ImageState.ERROR;
		this.unlistenImage_();
		this.dispatchChangeEvent_();
	}


	/**
	 * @private
	 */
	private handleImageLoad_() {
		this.imageState_ = ImageState.LOADED;
		if (this.size_) {
			this.image_.width = this.size_[0];
			this.image_.height = this.size_[1];
		}
		this.size_ = [this.image_.width, this.image_.height];
		this.unlistenImage_();
		this.determineTainting_();
		this.replaceColor_();
		this.dispatchChangeEvent_();
	}
}

/**
 * @param {Image|HTMLCanvasElement} image Image.
 * @param {string} src Src.
 * @param {module:ol/size~Size} size Size.
 * @param {?string} crossOrigin Cross origin.
 * @param {module:ol/ImageState} imageState Image state.
 * @param {module:ol/color~Color} color Color.
 * @return {module:ol/style/IconImage} Icon image.
 */
export function get(image: HTMLImageElement | HTMLCanvasElement, src: string, size: Size, crossOrigin: string, imageState: ImageState, color: Color) {
	let iconImage = iconImageCache.get(src, crossOrigin, color);
	if (!iconImage) {
		iconImage = new IconImage(image, src, size, crossOrigin, imageState, color);
		iconImageCache.set(src, crossOrigin, color, iconImage);
	}
	return iconImage;
}
