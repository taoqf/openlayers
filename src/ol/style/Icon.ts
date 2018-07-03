/**
 * @module ol/style/Icon
 */
import { assert } from '../asserts';
import { asArray, Color } from '../color';
import { listen, unlisten } from '../events';
import Event from '../events/Event';
import EventType from '../events/EventType';
import ImageState from '../ImageState';
import { getUid } from '../index';
import { Size } from '../size';
import IconAnchorUnits from '../style/IconAnchorUnits';
import IconImage, { get as getIconImage } from '../style/IconImage';
import IconOrigin from '../style/IconOrigin';
import ImageStyle from '../style/Image';


/**
 * @typedef {Object} Options
 * @property {Array.<number>} [anchor=[0.5, 0.5]] Anchor. Default value is the icon center.
 * @property {module:ol/style/IconOrigin} [anchorOrigin] Origin of the anchor: `bottom-left`, `bottom-right`,
 * `top-left` or `top-right`. Default is `top-left`.
 * @property {module:ol/style/IconAnchorUnits} [anchorXUnits] Units in which the anchor x value is
 * specified. A value of `'fraction'` indicates the x value is a fraction of the icon. A value of `'pixels'` indicates
 * the x value in pixels. Default is `'fraction'`.
 * @property {module:ol/style/IconAnchorUnits} [anchorYUnits] Units in which the anchor y value is
 * specified. A value of `'fraction'` indicates the y value is a fraction of the icon. A value of `'pixels'` indicates
 * the y value in pixels. Default is `'fraction'`.
 * @property {module:ol/color~Color|string} [color] Color to tint the icon. If not specified,
 * the icon will be left as is.
 * @property {null|string} [crossOrigin] The `crossOrigin` attribute for loaded images. Note that you must provide a
 * `crossOrigin` value if you are using the WebGL renderer or if you want to access pixel data with the Canvas renderer.
 * See {@link https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image} for more detail.
 * @property {Image|HTMLCanvasElement} [img] Image object for the icon. If the `src` option is not provided then the
 * provided image must already be loaded. And in that case, it is required
 * to provide the size of the image, with the `imgSize` option.
 * @property {Array.<number>} [offset=[0, 0]] Offset, which, together with the size and the offset origin, define the
 * sub-rectangle to use from the original icon image.
 * @property {module:ol/style/IconOrigin} [offsetOrigin] Origin of the offset: `bottom-left`, `bottom-right`,
 * `top-left` or `top-right`. Default is `top-left`.
 * @property {number} [opacity=1] Opacity of the icon.
 * @property {number} [scale=1] Scale.
 * @property {boolean} [snapToPixel=true] If `true` integral numbers of pixels are used as the X and Y pixel coordinate
 * when drawing the icon in the output canvas. If `false` fractional numbers may be used. Using `true` allows for
 * "sharp" rendering (no blur), while using `false` allows for "accurate" rendering. Note that accuracy is important if
 * the icon's position is animated. Without it, the icon may jitter noticeably.
 * @property {boolean} [rotateWithView=false] Whether to rotate the icon with the view.
 * @property {number} [rotation=0] Rotation in radians (positive rotation clockwise).
 * @property {module:ol/size~Size} [size] Icon size in pixel. Can be used together with `offset` to define the
 * sub-rectangle to use from the origin (sprite) icon image.
 * @property {module:ol/size~Size} [imgSize] Image size in pixels. Only required if `img` is set and `src` is not, and
 * for SVG images in Internet Explorer 11. The provided `imgSize` needs to match the actual size of the image.
 * @property {string} [src] Image source URI.
 */

export interface Options {
	anchor: number[];
	anchorOrigin: IconOrigin;
	anchorXUnits: IconAnchorUnits;
	anchorYUnits: IconAnchorUnits;
	color: Color | string;
	crossOrigin: null | string;
	img: HTMLImageElement | HTMLCanvasElement;
	offset: [number, number];
	offsetOrigin: IconOrigin;
	opacity: number;
	scale: number;
	snapToPixel: boolean;
	rotateWithView: boolean;
	rotation: number;
	size: Size;
	imgSize: Size;
	src: string;
}

/**
 * @classdesc
 * Set icon style for vector features.
 *
 * @constructor
 * @param {module:ol/style/Icon~Options=} opt_options Options.
 * @extends {module:ol/style/Image}
 * @api
 */
export default class Icon extends ImageStyle {
	private anchor_: number[];
	private normalizedAnchor_: number[] | null;
	private anchorOrigin_: IconOrigin;
	private anchorXUnits_: IconAnchorUnits;
	private anchorYUnits_: IconAnchorUnits;
	private crossOrigin_: string | null;
	private color_: Color | null;
	private iconImage_: IconImage;
	private offset_: number[];
	private offsetOrigin_: IconOrigin;
	private origin_: number[] | null;
	private size_: Size | null;
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options || {};

		/**
		 * @type {boolean}
		 */
		const rotateWithView = options.rotateWithView !== undefined ?
			options.rotateWithView : false;

		/**
		 * @type {number}
		 */
		const rotation = options.rotation !== undefined ? options.rotation : 0;

		/**
		 * @type {number}
		 */
		const scale = options.scale !== undefined ? options.scale : 1;

		/**
		 * @type {boolean}
		 */
		const snapToPixel = options.snapToPixel !== undefined ?
			options.snapToPixel : true;
		const opacity = options.opacity !== undefined ? options.opacity : 1;
		super({
			opacity,
			rotateWithView,
			rotation,
			scale,
			snapToPixel
		});

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.anchor_ = options.anchor !== undefined ? options.anchor : [0.5, 0.5];

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.normalizedAnchor_ = null;

		/**
		 * @private
		 * @type {module:ol/style/IconOrigin}
		 */
		this.anchorOrigin_ = options.anchorOrigin !== undefined ?
			options.anchorOrigin : IconOrigin.TOP_LEFT;

		/**
		 * @private
		 * @type {module:ol/style/IconAnchorUnits}
		 */
		this.anchorXUnits_ = options.anchorXUnits !== undefined ?
			options.anchorXUnits : IconAnchorUnits.FRACTION;

		/**
		 * @private
		 * @type {module:ol/style/IconAnchorUnits}
		 */
		this.anchorYUnits_ = options.anchorYUnits !== undefined ?
			options.anchorYUnits : IconAnchorUnits.FRACTION;

		/**
		 * @private
		 * @type {?string}
		 */
		this.crossOrigin_ =
			options.crossOrigin !== undefined ? options.crossOrigin : null;

		/**
		 * @type {Image|HTMLCanvasElement}
		 */
		const image = options.img !== undefined ? options.img : null;

		/**
		 * @type {module:ol/size~Size}
		 */
		const imgSize = options.imgSize !== undefined ? options.imgSize : null;

		/**
		 * @type {string|undefined}
		 */
		let src = options.src;

		assert(!(src !== undefined && image),
			4); // `image` and `src` cannot be provided at the same time
		assert(!image || (image && imgSize),
			5); // `imgSize` must be set when `image` is provided

		if ((src === undefined || src.length === 0) && image) {
			src = (image as HTMLImageElement).src || getUid(image).toString();
		}
		assert(src !== undefined && src.length > 0,
			6); // A defined and non-empty `src` or `image` must be provided

		/**
		 * @type {module:ol/ImageState}
		 */
		const imageState = options.src !== undefined ?
			ImageState.IDLE : ImageState.LOADED;

		/**
		 * @private
		 * @type {module:ol/color~Color}
		 */
		this.color_ = options.color !== undefined ? asArray(options.color) : null;

		/**
		 * @private
		 * @type {module:ol/style/IconImage}
		 */
		this.iconImage_ = getIconImage(
			image!, /** @type {string} */(src!), imgSize!, this.crossOrigin_!, imageState, this.color_!);

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.offset_ = options.offset !== undefined ? options.offset : [0, 0];

		/**
		 * @private
		 * @type {module:ol/style/IconOrigin}
		 */
		this.offsetOrigin_ = options.offsetOrigin !== undefined ?
			options.offsetOrigin : IconOrigin.TOP_LEFT;

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.origin_ = null;

		/**
		 * @private
		 * @type {module:ol/size~Size}
		 */
		this.size_ = options.size !== undefined ? options.size : null;
	}


	/**
	 * Clones the style. The underlying Image/HTMLCanvasElement is not cloned.
	 * @return {module:ol/style/Icon} The cloned style.
	 * @api
	 */
	public clone() {
		return new Icon({
			anchor: this.anchor_.slice(),
			anchorOrigin: this.anchorOrigin_,
			anchorXUnits: this.anchorXUnits_,
			anchorYUnits: this.anchorYUnits_,
			color: (this.color_ && this.color_.slice) ? this.color_.slice() as Color : this.color_ || undefined,
			crossOrigin: this.crossOrigin_,
			offset: this.offset_.slice() as [number, number],
			offsetOrigin: this.offsetOrigin_,
			opacity: this.getOpacity(),
			rotateWithView: this.getRotateWithView(),
			rotation: this.getRotation(),
			scale: this.getScale(),
			size: this.size_ !== null ? this.size_.slice() as Size : undefined,
			snapToPixel: this.getSnapToPixel(),
			src: this.getSrc()
		});
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getAnchor() {
		if (this.normalizedAnchor_) {
			return this.normalizedAnchor_;
		}
		let anchor = this.anchor_;
		const size = this.getSize();
		if (this.anchorXUnits_ === IconAnchorUnits.FRACTION ||
			this.anchorYUnits_ === IconAnchorUnits.FRACTION) {
			if (!size) {
				return null;
			}
			anchor = this.anchor_.slice();
			if (this.anchorXUnits_ === IconAnchorUnits.FRACTION) {
				anchor[0] *= size[0];
			}
			if (this.anchorYUnits_ === IconAnchorUnits.FRACTION) {
				anchor[1] *= size[1];
			}
		}

		if (this.anchorOrigin_ !== IconOrigin.TOP_LEFT) {
			if (!size) {
				return null;
			}
			if (anchor === this.anchor_) {
				anchor = this.anchor_.slice();
			}
			if (this.anchorOrigin_ === IconOrigin.TOP_RIGHT ||
				this.anchorOrigin_ === IconOrigin.BOTTOM_RIGHT) {
				anchor[0] = -anchor[0] + size[0];
			}
			if (this.anchorOrigin_ === IconOrigin.BOTTOM_LEFT ||
				this.anchorOrigin_ === IconOrigin.BOTTOM_RIGHT) {
				anchor[1] = -anchor[1] + size[1];
			}
		}
		this.normalizedAnchor_ = anchor;
		return this.normalizedAnchor_;
	}


	/**
	 * Get the icon color.
	 * @return {module:ol/color~Color} Color.
	 * @api
	 */
	public getColor() {
		return this.color_;
	}


	/**
	 * Get the image icon.
	 * @param {number} pixelRatio Pixel ratio.
	 * @return {Image|HTMLCanvasElement} Image or Canvas element.
	 * @override
	 * @api
	 */
	public getImage(pixelRatio: number) {
		return this.iconImage_.getImage(pixelRatio);
	}


	/**
	 * @override
	 */
	public getImageSize() {
		return this.iconImage_.getSize();
	}


	/**
	 * @override
	 */
	public getHitDetectionImageSize() {
		return this.getImageSize();
	}


	/**
	 * @override
	 */
	public getImageState() {
		return this.iconImage_.getImageState();
	}


	/**
	 * @override
	 */
	public getHitDetectionImage(pixelRatio: number) {
		return this.iconImage_.getHitDetectionImage(pixelRatio);
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getOrigin() {
		if (this.origin_) {
			return this.origin_;
		}
		let offset = this.offset_;

		if (this.offsetOrigin_ !== IconOrigin.TOP_LEFT) {
			const size = this.getSize();
			const iconImageSize = this.iconImage_.getSize();
			if (!size || !iconImageSize) {
				return null;
			}
			offset = offset.slice();
			if (this.offsetOrigin_ === IconOrigin.TOP_RIGHT ||
				this.offsetOrigin_ === IconOrigin.BOTTOM_RIGHT) {
				offset[0] = iconImageSize[0] - size[0] - offset[0];
			}
			if (this.offsetOrigin_ === IconOrigin.BOTTOM_LEFT ||
				this.offsetOrigin_ === IconOrigin.BOTTOM_RIGHT) {
				offset[1] = iconImageSize[1] - size[1] - offset[1];
			}
		}
		this.origin_ = offset;
		return this.origin_;
	}


	/**
	 * Get the image URL.
	 * @return {string|undefined} Image src.
	 * @api
	 */
	public getSrc() {
		return this.iconImage_.getSrc();
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getSize() {
		return !this.size_ ? this.iconImage_.getSize() : this.size_;
	}


	/**
	 * @override
	 */
	public listenImageChange<T>(listener: (this: T, e: Event) => void, thisArg: T) {
		return listen(this.iconImage_, EventType.CHANGE,
			listener, thisArg);
	}


	/**
	 * Load not yet loaded URI.
	 * When rendering a feature with an icon style, the vector renderer will
	 * automatically call this method. However, you might want to call this
	 * method yourself for preloading or other purposes.
	 * @override
	 * @api
	 */
	public load() {
		this.iconImage_.load();
	}


	/**
	 * @override
	 */
	public unlistenImageChange<T>(listener: (this: T, e: Event) => void, thisArg: T) {
		unlisten(this.iconImage_, EventType.CHANGE,
			listener, thisArg);
	}
}
