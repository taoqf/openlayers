/**
 * @module ol/layer/Heatmap
 */
import { createCanvasContext2D } from '../dom';
import { listen } from '../events';
import { Extent } from '../extent';
import Feature from '../Feature';
import VectorLayer from '../layer/Vector';
import { clamp } from '../math';
import { assign } from '../obj';
import { getChangeEventType } from '../Object';
import RenderEvent from '../render/Event';
import RenderEventType from '../render/EventType';
import RenderFeature from '../render/Feature';
import VectorSource from '../source/Vector';
import Icon from '../style/Icon';
import Style from '../style/Style';

/**
 * @typedef {Object} Options
 * @property {number} [opacity=1] Opacity (0, 1).
 * @property {boolean} [visible=true] Visibility.
 * @property {module:ol/extent~Extent} [extent] The bounding extent for layer rendering.  The layer will not be
 * rendered outside of this extent.
 * @property {number} [zIndex=0] The z-index for layer rendering.  At rendering time, the layers
 * will be ordered, first by Z-index and then by position.
 * @property {number} [minResolution] The minimum resolution (inclusive) at which this layer will be
 * visible.
 * @property {number} [maxResolution] The maximum resolution (exclusive) below which this layer will
 * be visible.
 * @property {Array.<string>} [gradient=['#00f', '#0ff', '#0f0', '#ff0', '#f00']] The color gradient
 * of the heatmap, specified as an array of CSS color strings.
 * @property {number} [radius=8] Radius size in pixels.
 * @property {number} [blur=15] Blur size in pixels.
 * @property {number} [shadow=250] Shadow size in pixels.
 * @property {string|function(module:ol/Feature):number} [weight='weight'] The feature
 * attribute to use for the weight or a function that returns a weight from a feature. Weight values
 * should range from 0 to 1 (and values outside will be clamped to that range).
 * @property {module:ol/source/Vector} [source] Source.
 */

export interface Options {
	opacity: number;
	visible: boolean;
	extent: Extent;
	zIndex: number;
	minResolution: number;
	maxResolution: number;
	gradient: [string, string, string, string, string];
	radius: number;
	blur: number;
	shadow: number;
	weight: string | ((module: Feature | RenderFeature) => number);
	source: VectorSource;
}

/**
 * @enum {string}
 * @private
 */
enum Property {
	BLUR = 'blur',
	GRADIENT = 'gradient',
	RADIUS = 'radius'
}


/**
 * @const
 * @type {Array.<string>}
 */
const DEFAULT_GRADIENT = ['#00f', '#0ff', '#0f0', '#ff0', '#f00'];


/**
 * @classdesc
 * Layer for rendering vector data as a heatmap.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @constructor
 * @extends {module:ol/layer/Vector}
 * @fires module:ol/render/Event~RenderEvent
 * @param {module:ol/layer/Heatmap~Options=} opt_options Options.
 * @api
 */
export default class Heatmap extends VectorLayer {
	private gradient_: Uint8ClampedArray | null;
	private shadow_: number;
	private circleImage_: string | undefined;
	private styleCache_: Style[][];
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options ? opt_options : {};

		const baseOptions = assign({}, options);

		delete baseOptions.gradient;
		delete baseOptions.radius;
		delete baseOptions.blur;
		delete baseOptions.shadow;
		delete baseOptions.weight;
		super(/** @type {module:ol/layer/Vector~Options} */(baseOptions));

		/**
		 * @private
		 * @type {Uint8ClampedArray}
		 */
		this.gradient_ = null;

		/**
		 * @private
		 * @type {number}
		 */
		this.shadow_ = options.shadow !== undefined ? options.shadow : 250;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.circleImage_ = undefined;

		/**
		 * @private
		 * @type {Array.<Array.<module:ol/style/Style>>}
		 */
		this.styleCache_ = null!;

		listen(this,
			getChangeEventType(Property.GRADIENT),
			this.handleGradientChanged_, this);

		this.setGradient(options.gradient ? options.gradient : DEFAULT_GRADIENT);

		this.setBlur(options.blur !== undefined ? options.blur : 15);

		this.setRadius(options.radius !== undefined ? options.radius : 8);

		listen(this,
			getChangeEventType(Property.BLUR),
			this.handleStyleChanged_, this);
		listen(this,
			getChangeEventType(Property.RADIUS),
			this.handleStyleChanged_, this);

		this.handleStyleChanged_();

		const weight = options.weight ? options.weight : 'weight';
		const weightFunction = typeof weight === 'string' ? ((feature: Feature | RenderFeature) => {
			return feature.get(weight) as number;
		}) : weight;

		this.setStyle((feature, _resolution) => {
			const w = weightFunction(feature);
			const opacity = w !== undefined ? clamp(w, 0, 1) : 1;
			// cast to 8 bits
			const index = (255 * opacity) | 0;
			let style = this.styleCache_[index];
			if (!style) {
				style = [
					new Style({
						image: new Icon({
							opacity,
							src: this.circleImage_
						})
					})
				];
				this.styleCache_[index] = style;
			}
			return style;
		});

		// For performance reasons, don't sort the features before rendering.
		// The render order is not relevant for a heatmap representation.
		this.setRenderOrder(null);

		listen(this, RenderEventType.RENDER, this.handleRender_, this);
	}

	/**
	 * Return the blur size in pixels.
	 * @return {number} Blur size in pixels.
	 * @api
	 * @observable
	 */
	public getBlur() {
		return /** @type {number} */ (this.get(Property.BLUR));
	}


	/**
	 * Return the gradient colors as array of strings.
	 * @return {Array.<string>} Colors.
	 * @api
	 * @observable
	 */
	public getGradient() {
		return /** @type {Array.<string>} */ (this.get(Property.GRADIENT));
	}


	/**
	 * Return the size of the radius in pixels.
	 * @return {number} Radius size in pixel.
	 * @api
	 * @observable
	 */
	public getRadius() {
		return /** @type {number} */ (this.get(Property.RADIUS));
	}


	/**
	 * Set the blur size in pixels.
	 * @param {number} blur Blur size in pixels.
	 * @api
	 * @observable
	 */
	public setBlur(blur: number) {
		this.set(Property.BLUR, blur);
	}


	/**
	 * Set the gradient colors as array of strings.
	 * @param {Array.<string>} colors Gradient.
	 * @api
	 * @observable
	 */
	public setGradient(colors: string[]) {
		this.set(Property.GRADIENT, colors);
	}


	/**
	 * Set the size of the radius in pixels.
	 * @param {number} radius Radius size in pixel.
	 * @api
	 * @observable
	 */
	public setRadius(radius: number) {
		this.set(Property.RADIUS, radius);
	}


	/**
	 * @private
	 */
	private handleGradientChanged_() {
		this.gradient_ = createGradient(this.getGradient());
	}


	/**
	 * @private
	 */
	private handleStyleChanged_() {
		this.circleImage_ = this.createCircle_();
		this.styleCache_ = new Array(256);
		this.changed();
	}


	/**
	 * @param {module:ol/render/Event} event Post compose event
	 * @private
	 */
	private handleRender_(event: RenderEvent) {
		const context = event.context!;
		const canvas = context.canvas;
		const image = context.getImageData(0, 0, canvas.width, canvas.height);
		const view8 = image.data;
		for (let i = 0, ii = view8.length; i < ii; i += 4) {
			const alpha = view8[i + 3] * 4;
			if (alpha) {
				view8[i] = this.gradient_![alpha];
				view8[i + 1] = this.gradient_![alpha + 1];
				view8[i + 2] = this.gradient_![alpha + 2];
			}
		}
		context.putImageData(image, 0, 0);
	}

	/**
	 * @return {string} Data URL for a circle.
	 * @private
	 */
	private createCircle_() {
		const radius = this.getRadius();
		const blur = this.getBlur();
		const halfSize = radius + blur + 1;
		const size = 2 * halfSize;
		const context = createCanvasContext2D(size, size)!;
		context.shadowOffsetX = context.shadowOffsetY = this.shadow_;
		context.shadowBlur = blur;
		context.shadowColor = '#000';
		context.beginPath();
		const center = halfSize - this.shadow_;
		context.arc(center, center, radius, 0, Math.PI * 2, true);
		context.fill();
		return context.canvas.toDataURL();
	}
}

/**
 * @param {Array.<string>} colors A list of colored.
 * @return {Uint8ClampedArray} An array.
 * @private
 */
function createGradient(colors: string[]) {
	const width = 1;
	const height = 256;
	const context = createCanvasContext2D(width, height)!;

	const gradient = context.createLinearGradient(0, 0, width, height);
	const step = 1 / (colors.length - 1);
	for (let i = 0, ii = colors.length; i < ii; ++i) {
		gradient.addColorStop(i * step, colors[i]);
	}

	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);

	return context.getImageData(0, 0, width, height).data;
}
