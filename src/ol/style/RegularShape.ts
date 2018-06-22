/**
 * @module ol/style/RegularShape
 */
import { asColorLike, ColorLike } from '../colorlike';
import { createCanvasContext2D } from '../dom';
import { CANVAS_LINE_DASH } from '../has';
import ImageState from '../ImageState';
import { defaultFillStyle, defaultLineCap, defaultLineJoin, defaultLineWidth, defaultMiterLimit, defaultStrokeStyle } from '../render/canvas';
import { Size } from '../size';
import ImageStyle from '../style/Image';
import AtlasManager from './AtlasManager';
import Fill from './Fill';
import Stroke from './Stroke';


/**
 * Specify radius for regular polygons, or radius1 and radius2 for stars.
 * @typedef {Object} Options
 * @property {module:ol/style/Fill} [fill] Fill style.
 * @property {number} points Number of points for stars and regular polygons. In case of a polygon, the number of points
 * is the number of sides.
 * @property {number} [radius] Radius of a regular polygon.
 * @property {number} [radius1] Outer radius of a star.
 * @property {number} [radius2] Inner radius of a star.
 * @property {number} [angle=0] Shape's angle in radians. A value of 0 will have one of the shape's point facing up.
 * @property {boolean} [snapToPixel=true] If `true` integral numbers of pixels are used as the X and Y pixel coordinate
 * when drawing the shape in the output canvas. If `false` fractional numbers may be used. Using `true` allows for
 * "sharp" rendering (no blur), while using `false` allows for "accurate" rendering. Note that accuracy is important if
 * the shape's position is animated. Without it, the shape may jitter noticeably.
 * @property {module:ol/style/Stroke} [stroke] Stroke style.
 * @property {number} [rotation=0] Rotation in radians (positive rotation clockwise).
 * @property {boolean} [rotateWithView=false] Whether to rotate the shape with the view.
 * @property {module:ol/style/AtlasManager} [atlasManager] The atlas manager to use for this symbol. When
 * using WebGL it is recommended to use an atlas manager to avoid texture switching. If an atlas manager is given, the
 * symbol is added to an atlas. By default no atlas manager is used.
 */

export interface Options {
	fill: Fill;
	points: number;
	radius: number;
	radius1: number;
	radius2: number;
	angle: number;
	snapToPixel: boolean;
	stroke: Stroke;
	rotation: number;
	rotateWithView: boolean;
	atlasManager: AtlasManager;
}

/**
 * @typedef {Object} RenderOptions
 * @property {module:ol/colorlike~ColorLike} [strokeStyle]
 * @property {number} strokeWidth
 * @property {number} size
 * @property {string} lineCap
 * @property {Array.<number>} lineDash
 * @property {number} lineDashOffset
 * @property {string} lineJoin
 * @property {number} miterLimit
 */

export interface RenderOptions {
	strokeStyle: ColorLike;
	strokeWidth: number;
	size: number;
	lineCap: string;
	lineDash: number[];
	lineDashOffset: number;
	lineJoin: string;
	miterLimit: number;
}

/**
 * @classdesc
 * Set regular shape style for vector features. The resulting shape will be
 * a regular polygon when `radius` is provided, or a star when `radius1` and
 * `radius2` are provided.
 *
 * @constructor
 * @param {module:ol/style/RegularShape~Options} options Options.
 * @extends {module:ol/style/Image}
 * @api
 */
export default class RegularShape extends ImageStyle {
	protected radius: number | undefined;
	protected atlasManager: AtlasManager | undefined;
	/**
	 * @private
	 * @type {Array.<string>}
	 */
	private checksums: [string, string, string, number, number, number, number] | null;

	/**
	 * @private
	 * @type {HTMLCanvasElement}
	 */
	private canvas: HTMLCanvasElement | null;

	/**
	 * @private
	 * @type {HTMLCanvasElement}
	 */
	private hitDetectionCanvas: HTMLCanvasElement | null;

	/**
	 * @private
	 * @type {Array.<number>}
	 */
	private origin: number[];
	private fill: Fill | null;
	private points: number;
	private radius2: number;
	private angle: number;
	private stroke: Stroke | null;
	private anchor: number[] | null;
	private size: Size | null;
	private imageSize: Size | null;
	private hitDetectionImageSize: Size | null;

	constructor(options: Partial<Options>) {
		/**
		 * @type {boolean}
		 */
		const snapToPixel = options.snapToPixel !== undefined ?
			options.snapToPixel : true;

		/**
		 * @type {boolean}
		 */
		const rotateWithView = options.rotateWithView !== undefined ?
			options.rotateWithView : false;

		super({
			opacity: 1,
			rotateWithView,
			rotation: options.rotation !== undefined ? options.rotation : 0,
			scale: 1,
			snapToPixel
		});
		this.checksums = null;
		this.hitDetectionCanvas = null;
		this.canvas = null;
		this.origin = [0, 0];
		/**
		 * @private
		 * @type {module:ol/style/Fill}
		 */
		this.fill = options.fill !== undefined ? options.fill : null;

		/**
		 * @private
		 * @type {number}
		 */
		this.points = options.points!;

		/**
		 * @protected
		 * @type {number}
		 */
		this.radius = /** @type {number} */ (options.radius !== undefined ?
			options.radius : options.radius1)!;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.radius2 = options.radius2!;

		/**
		 * @private
		 * @type {number}
		 */
		this.angle = options.angle !== undefined ? options.angle : 0;

		/**
		 * @private
		 * @type {module:ol/style/Stroke}
		 */
		this.stroke = options.stroke !== undefined ? options.stroke : null;

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.anchor = null;

		/**
		 * @private
		 * @type {module:ol/size~Size}
		 */
		this.size = null;

		/**
		 * @private
		 * @type {module:ol/size~Size}
		 */
		this.imageSize = null;

		/**
		 * @private
		 * @type {module:ol/size~Size}
		 */
		this.hitDetectionImageSize = null;

		/**
		 * @protected
		 * @type {module:ol/style/AtlasManager|undefined}
		 */
		this.atlasManager = options.atlasManager;

		this.render_(this.atlasManager);
	}


	/**
	 * Clones the style. If an atlasmanager was provided to the original style it will be used in the cloned style, too.
	 * @return {module:ol/style/RegularShape} The cloned style.
	 * @api
	 */
	public clone() {
		const style = new RegularShape({
			angle: this.getAngle(),
			atlasManager: this.atlasManager,
			fill: this.getFill() ? this.getFill()!.clone() : undefined,
			points: this.getPoints(),
			radius: this.getRadius(),
			radius2: this.getRadius2(),
			rotateWithView: this.getRotateWithView(),
			rotation: this.getRotation(),
			snapToPixel: this.getSnapToPixel(),
			stroke: this.getStroke() ? this.getStroke()!.clone() : undefined
		});
		style.setOpacity(this.getOpacity());
		style.setScale(this.getScale());
		return style;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getAnchor() {
		return this.anchor;
	}


	/**
	 * Get the angle used in generating the shape.
	 * @return {number} Shape's rotation in radians.
	 * @api
	 */
	public getAngle() {
		return this.angle;
	}


	/**
	 * Get the fill style for the shape.
	 * @return {module:ol/style/Fill} Fill style.
	 * @api
	 */
	public getFill() {
		return this.fill;
	}


	/**
	 * @inheritDoc
	 */
	public getHitDetectionImage(_pixelRatio: number) {
		return this.hitDetectionCanvas;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getImage(_pixelRatio: number) {
		return this.canvas;
	}


	/**
	 * @inheritDoc
	 */
	public getImageSize() {
		return this.imageSize;
	}


	/**
	 * @inheritDoc
	 */
	public getHitDetectionImageSize() {
		return this.hitDetectionImageSize;
	}


	/**
	 * @inheritDoc
	 */
	public getImageState() {
		return ImageState.LOADED;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getOrigin() {
		return this.origin;
	}


	/**
	 * Get the number of points for generating the shape.
	 * @return {number} Number of points for stars and regular polygons.
	 * @api
	 */
	public getPoints() {
		return this.points;
	}


	/**
	 * Get the (primary) radius for the shape.
	 * @return {number} Radius.
	 * @api
	 */
	public getRadius() {
		return this.radius;
	}


	/**
	 * Get the secondary radius for the shape.
	 * @return {number|undefined} Radius2.
	 * @api
	 */
	public getRadius2() {
		return this.radius2;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getSize() {
		return this.size;
	}


	/**
	 * Get the stroke style for the shape.
	 * @return {module:ol/style/Stroke} Stroke style.
	 * @api
	 */
	public getStroke() {
		return this.stroke;
	}


	/**
	 * @inheritDoc
	 */
	public listenImageChange() { }


	/**
	 * @inheritDoc
	 */
	public load() { }


	/**
	 * @inheritDoc
	 */
	public unlistenImageChange() { }


	/**
	 * @return {string} The checksum.
	 */
	public getChecksum() {
		const strokeChecksum = this.stroke ?
			this.stroke.getChecksum() : '-';
		const fillChecksum = this.fill ?
			this.fill.getChecksum() : '-';

		const recalculate = !this.checksums ||
			(strokeChecksum !== this.checksums[1] ||
				fillChecksum !== this.checksums[2] ||
				this.radius !== this.checksums[3] ||
				this.radius2 !== this.checksums[4] ||
				this.angle !== this.checksums[5] ||
				this.points !== this.checksums[6]);

		if (recalculate) {
			const checksum = 'r' + strokeChecksum + fillChecksum +
				(this.radius !== undefined ? this.radius.toString() : '-') +
				(this.radius2 !== undefined ? this.radius2.toString() : '-') +
				(this.angle !== undefined ? this.angle.toString() : '-') +
				(this.points !== undefined ? this.points.toString() : '-');
			this.checksums = [checksum, strokeChecksum, fillChecksum,
				this.radius!, this.radius2, this.angle, this.points];
		}

		return this.checksums![0];
	}

	/**
	 * @protected
	 * @param {module:ol/style/AtlasManager|undefined} atlasManager An atlas manager.
	 */
	protected render_(atlasManager: AtlasManager | undefined) {
		let imageSize;
		let lineCap = '';
		let lineJoin = '';
		let miterLimit = 0;
		let lineDash = null;
		let lineDashOffset = 0;
		let strokeStyle;
		let strokeWidth = 0;

		if (this.stroke) {
			const stroke_style = this.stroke.getColor() || defaultStrokeStyle;
			strokeStyle = asColorLike(stroke_style);
			strokeWidth = this.stroke.getWidth() || defaultLineWidth;
			lineDash = this.stroke.getLineDash();
			lineDashOffset = this.stroke.getLineDashOffset()!;
			if (!CANVAS_LINE_DASH) {
				lineDash = null;
				lineDashOffset = 0;
			}
			lineJoin = this.stroke.getLineJoin() || defaultLineJoin;
			lineCap = this.stroke.getLineCap() || defaultLineCap;
			miterLimit = this.stroke.getMiterLimit() || defaultMiterLimit;
		}

		let size = 2 * (this.radius! + strokeWidth) + 1;

		/** @type {module:ol/style/RegularShape~RenderOptions} */
		const renderOptions = {
			lineCap,
			lineDash,
			lineDashOffset,
			lineJoin,
			miterLimit,
			size,
			strokeStyle,
			strokeWidth
		} as RenderOptions;

		if (atlasManager === undefined) {
			// no atlas manager is used, create a new canvas
			const context = createCanvasContext2D(size, size)!;
			this.canvas = context.canvas;

			// canvas.width and height are rounded to the closest integer
			size = this.canvas.width;
			imageSize = size;

			this.draw_(renderOptions, context, 0, 0);

			this.createHitDetectionCanvas_(renderOptions);
		} else {
			// an atlas manager is used, add the symbol to an atlas
			size = Math.round(size);

			const hasCustomHitDetectionImage = !this.fill;
			let renderHitDetectionCallback;
			if (hasCustomHitDetectionImage) {
				// render the hit-detection image into a separate atlas image
				renderHitDetectionCallback =
					this.drawHitDetectionCanvas_.bind(this, renderOptions);
			}

			const id = this.getChecksum();
			const info = atlasManager.add(
				id, size, size, this.draw_.bind(this, renderOptions),
				renderHitDetectionCallback)!;

			this.canvas = info.image;
			this.origin = [info.offsetX, info.offsetY];
			imageSize = info.image.width;

			if (hasCustomHitDetectionImage) {
				this.hitDetectionCanvas = info.hitImage;
				this.hitDetectionImageSize =
					[info.hitImage.width, info.hitImage.height];
			} else {
				this.hitDetectionCanvas = this.canvas;
				this.hitDetectionImageSize = [imageSize, imageSize];
			}
		}

		this.anchor = [size / 2, size / 2];
		this.size = [size, size];
		this.imageSize = [imageSize, imageSize];
	}


	/**
	 * @private
	 * @param {module:ol/style/RegularShape~RenderOptions} renderOptions Render options.
	 * @param {CanvasRenderingContext2D} context The rendering context.
	 * @param {number} x The origin for the symbol (x).
	 * @param {number} y The origin for the symbol (y).
	 */
	private draw_(renderOptions: RenderOptions, context: CanvasRenderingContext2D, x: number, y: number) {
		// reset transform
		context.setTransform(1, 0, 0, 1, 0, 0);

		// then move to (x, y)
		context.translate(x, y);

		context.beginPath();

		let points = this.points;
		if (points === Infinity) {
			context.arc(
				renderOptions.size / 2, renderOptions.size / 2,
				this.radius!, 0, 2 * Math.PI, true);
		} else {
			const radius2 = (this.radius2 !== undefined) ? this.radius2
				: this.radius!;
			if (radius2 !== this.radius) {
				points = 2 * points;
			}
			for (let i = 0; i <= points; i++) {
				const angle0 = i * 2 * Math.PI / points - Math.PI / 2 + this.angle;
				const radiusC = i % 2 === 0 ? this.radius! : radius2;
				context.lineTo(renderOptions.size / 2 + radiusC * Math.cos(angle0),
					renderOptions.size / 2 + radiusC * Math.sin(angle0));
			}
		}


		if (this.fill) {
			const color = this.fill.getColor() || defaultFillStyle;
			context.fillStyle = asColorLike(color) as string | CanvasPattern | CanvasGradient;
			context.fill();
		}
		if (this.stroke) {
			context.strokeStyle = renderOptions.strokeStyle;
			context.lineWidth = renderOptions.strokeWidth;
			if (renderOptions.lineDash) {
				context.setLineDash(renderOptions.lineDash);
				context.lineDashOffset = renderOptions.lineDashOffset;
			}
			context.lineCap = renderOptions.lineCap;
			context.lineJoin = renderOptions.lineJoin;
			context.miterLimit = renderOptions.miterLimit;
			context.stroke();
		}
		context.closePath();
	}


	/**
	 * @private
	 * @param {module:ol/style/RegularShape~RenderOptions} renderOptions Render options.
	 */
	private createHitDetectionCanvas_(renderOptions: RenderOptions) {
		this.hitDetectionImageSize = [renderOptions.size, renderOptions.size];
		if (this.fill) {
			this.hitDetectionCanvas = this.canvas;
			return;
		}

		// if no fill style is set, create an extra hit-detection image with a
		// default fill style
		const context = createCanvasContext2D(renderOptions.size, renderOptions.size)!;
		this.hitDetectionCanvas = context.canvas;

		this.drawHitDetectionCanvas_(renderOptions, context, 0, 0);
	}


	/**
	 * @private
	 * @param {module:ol/style/RegularShape~RenderOptions} renderOptions Render options.
	 * @param {CanvasRenderingContext2D} context The context.
	 * @param {number} x The origin for the symbol (x).
	 * @param {number} y The origin for the symbol (y).
	 */
	private drawHitDetectionCanvas_(renderOptions: RenderOptions, context: CanvasRenderingContext2D, x: number, y: number) {
		// reset transform
		context.setTransform(1, 0, 0, 1, 0, 0);

		// then move to (x, y)
		context.translate(x, y);

		context.beginPath();

		let points = this.points;
		if (points === Infinity) {
			context.arc(
				renderOptions.size / 2, renderOptions.size / 2,
				this.radius!, 0, 2 * Math.PI, true);
		} else {
			const radius2 = (this.radius2 !== undefined) ? this.radius2 : this.radius!;
			if (radius2 !== this.radius) {
				points = 2 * points;
			}
			for (let i = 0; i <= points; i++) {
				const angle0 = i * 2 * Math.PI / points - Math.PI / 2 + this.angle;
				const radiusC = i % 2 === 0 ? this.radius! : radius2;
				context.lineTo(renderOptions.size / 2 + radiusC * Math.cos(angle0),
					renderOptions.size / 2 + radiusC * Math.sin(angle0));
			}
		}

		context.fillStyle = defaultFillStyle as any;
		context.fill();
		if (this.stroke) {
			context.strokeStyle = renderOptions.strokeStyle;
			context.lineWidth = renderOptions.strokeWidth;
			if (renderOptions.lineDash) {
				context.setLineDash(renderOptions.lineDash);
				context.lineDashOffset = renderOptions.lineDashOffset;
			}
			context.stroke();
		}
		context.closePath();
	}
}
