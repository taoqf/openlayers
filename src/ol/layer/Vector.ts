/**
 * @module ol/layer/Vector
 */
import { Extent } from '../extent';
import Layer from '../layer/Layer';
import VectorRenderType from '../layer/VectorRenderType';
import LayerType from '../LayerType';
import { assign } from '../obj';
import PluggableMap from '../PluggableMap';
import { OrderFunction } from '../render';
import VectorSource from '../source/Vector';
import Style from '../style/Style';
import { createDefaultStyle, StyleFunction, toFunction as toStyleFunction } from '../style/Style';

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
 * @property {module:ol/render~OrderFunction} [renderOrder] Render order. Function to be used when sorting
 * features before rendering. By default features are drawn in the order that they are created. Use
 * `null` to avoid the sort, but get an undefined draw order.
 * @property {number} [renderBuffer=100] The buffer in pixels around the viewport extent used by the
 * renderer when getting features from the vector source for the rendering or hit-detection.
 * Recommended value: the size of the largest symbol, line width or label.
 * @property {module:ol/layer/VectorRenderType|string} [renderMode='vector'] Render mode for vector layers:
 *  * `'image'`: Vector layers are rendered as images. Great performance, but point symbols and
 *    texts are always rotated with the view and pixels are scaled during zoom animations.
 *  * `'vector'`: Vector layers are rendered as vectors. Most accurate rendering even during
 *    animations, but slower performance.
 * @property {module:ol/source/Vector} [source] Source.
 * @property {module:ol/PluggableMap} [map] Sets the layer as overlay on a map. The map will not manage
 * this layer in its layers collection, and the layer will be rendered on top. This is useful for
 * temporary layers. The standard way to add a layer to a map and have it managed by the map is to
 * use {@link module:ol/Map#addLayer}.
 * @property {boolean} [declutter=false] Declutter images and text. Decluttering is applied to all
 * image and text styles, and the priority is defined by the z-index of the style. Lower z-index
 * means higher priority.
 * @property {module:ol/style/Style|Array.<module:ol/style/Style>|module:ol/style/Style~StyleFunction} [style] Layer style. See
 * {@link module:ol/style} for default style which will be used if this is not defined.
 * @property {number} [maxTilesLoading=16] Maximum number tiles to load simultaneously.
 * @property {boolean} [updateWhileAnimating=false] When set to `true` and `renderMode`
 * is `vector`, feature batches will be recreated during animations. This means that no
 * vectors will be shown clipped, but the setting will have a performance impact for large
 * amounts of vector data. When set to `false`, batches will be recreated when no animation
 * is active.
 * @property {boolean} [updateWhileInteracting=false] When set to `true` and `renderMode`
 * is `vector`, feature batches will be recreated during interactions. See also
 * `updateWhileAnimating`.
 */

export interface Options {
	opacity: number;
	visible: boolean;
	extent: Extent;
	zIndex: number;
	minResolution: number;
	maxResolution: number;
	renderOrder: OrderFunction;
	renderBuffer: number;
	renderMode: VectorRenderType | string;
	source: VectorSource;
	map: PluggableMap;
	declutter: boolean;
	style: Style | Style[] | StyleFunction;
	maxTilesLoading: number;
	updateWhileAnimating: boolean;
	updateWhileInteracting: boolean;
}

/**
 * @enum {string}
 * Render mode for vector layers:
 *  * `'image'`: Vector layers are rendered as images. Great performance, but
 *    point symbols and texts are always rotated with the view and pixels are
 *    scaled during zoom animations.
 *  * `'vector'`: Vector layers are rendered as vectors. Most accurate rendering
 *    even during animations, but slower performance.
 * @api
 */
export enum RenderType {
	IMAGE = 'image',
	VECTOR = 'vector'
}


/**
 * @enum {string}
 * @private
 */
enum Property {
	RENDER_ORDER = 'renderOrder'
}

/**
 * @classdesc
 * Vector data that is rendered client-side.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @constructor
 * @extends {module:ol/layer/Layer}
 * @fires module:ol/render/Event~RenderEvent
 * @param {module:ol/layer/Vector~Options=} opt_options Options.
 * @api
 */
export default class VectorLayer extends Layer {
	private declutter_: boolean;
	private renderBuffer_: number;
	private style_: Style | Style[] | StyleFunction | null;
	private styleFunction_: StyleFunction | undefined;
	private updateWhileAnimating_: boolean;
	private updateWhileInteracting_: boolean;
	private renderMode_: string;
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options ?
			opt_options : /** @type {module:ol/layer/Vector~Options} */ ({});

		const baseOptions = assign({}, options);

		delete baseOptions.style;
		delete baseOptions.renderBuffer;
		delete baseOptions.updateWhileAnimating;
		delete baseOptions.updateWhileInteracting;
		super(/** @type {module:ol/layer/Layer~Options} */(baseOptions));

		/**
		 * @private
		 * @type {boolean}
		 */
		this.declutter_ = options.declutter !== undefined ? options.declutter : false;

		/**
		 * @type {number}
		 * @private
		 */
		this.renderBuffer_ = options.renderBuffer !== undefined ?
			options.renderBuffer : 100;

		/**
		 * User provided style.
		 * @type {module:ol/style/Style|Array.<module:ol/style/Style>|module:ol/style/Style~StyleFunction}
		 * @private
		 */
		this.style_ = null;

		/**
		 * Style function for use within the library.
		 * @type {module:ol/style/Style~StyleFunction|undefined}
		 * @private
		 */
		this.styleFunction_ = undefined;

		this.setStyle(options.style);

		/**
		 * @type {boolean}
		 * @private
		 */
		this.updateWhileAnimating_ = options.updateWhileAnimating !== undefined ?
			options.updateWhileAnimating : false;

		/**
		 * @type {boolean}
		 * @private
		 */
		this.updateWhileInteracting_ = options.updateWhileInteracting !== undefined ?
			options.updateWhileInteracting : false;

		/**
		 * @private
		 * @type {module:ol/layer/VectorTileRenderType|string}
		 */
		this.renderMode_ = options.renderMode || VectorRenderType.VECTOR;

		/**
		 * The layer type.
		 * @protected
		 * @type {module:ol/LayerType}
		 */
		this.type = LayerType.VECTOR;

	}

	/**
	 * @return {boolean} Declutter.
	 */
	public getDeclutter() {
		return this.declutter_;
	}


	/**
	 * @param {boolean} declutter Declutter.
	 */
	public setDeclutter(declutter: boolean) {
		this.declutter_ = declutter;
	}


	/**
	 * @return {number|undefined} Render buffer.
	 */
	public getRenderBuffer() {
		return this.renderBuffer_;
	}


	/**
	 * @return {function(module:ol/Feature, module:ol/Feature): number|null|undefined} Render
	 *     order.
	 */
	public getRenderOrder() {
		return (
			/** @type {module:ol/render~OrderFunction|null|undefined} */ (this.get(Property.RENDER_ORDER))
		);
	}


	/**
	 * Return the associated {@link module:ol/source/Vector vectorsource} of the layer.
	 * @function
	 * @return {module:ol/source/Vector} Source.
	 * @api
	 */
	public getSource() {
		return super.getSource() as VectorSource;
	}

	/**
	 * Get the style for features.  This returns whatever was passed to the `style`
	 * option at construction or to the `setStyle` method.
	 * @return {module:ol/style/Style|Array.<module:ol/style/Style>|module:ol/style/Style~StyleFunction}
	 *     Layer style.
	 * @api
	 */
	public getStyle() {
		return this.style_;
	}


	/**
	 * Get the style function.
	 * @return {module:ol/style/Style~StyleFunction|undefined} Layer style function.
	 * @api
	 */
	public getStyleFunction() {
		return this.styleFunction_;
	}


	/**
	 * @return {boolean} Whether the rendered layer should be updated while
	 *     animating.
	 */
	public getUpdateWhileAnimating() {
		return this.updateWhileAnimating_;
	}


	/**
	 * @return {boolean} Whether the rendered layer should be updated while
	 *     interacting.
	 */
	public getUpdateWhileInteracting() {
		return this.updateWhileInteracting_;
	}


	/**
	 * @param {module:ol/render~OrderFunction|null|undefined} renderOrder
	 *     Render order.
	 */
	public setRenderOrder(renderOrder: OrderFunction | null | undefined) {
		this.set(Property.RENDER_ORDER, renderOrder);
	}


	/**
	 * Set the style for features.  This can be a single style object, an array
	 * of styles, or a function that takes a feature and resolution and returns
	 * an array of styles. If it is `undefined` the default style is used. If
	 * it is `null` the layer has no style (a `null` style), so only features
	 * that have their own styles will be rendered in the layer. See
	 * {@link module:ol/style} for information on the default style.
	 * @param {module:ol/style/Style|Array.<module:ol/style/Style>|module:ol/style/Style~StyleFunction|null|undefined}
	 *     style Layer style.
	 * @api
	 */
	public setStyle(style: Style | Style[] | StyleFunction | null | undefined) {
		this.style_ = style !== undefined ? style : createDefaultStyle;
		this.styleFunction_ = style === null ?
			undefined : toStyleFunction(this.style_!);
		this.changed();
	}

	/**
	 * @return {module:ol/layer/VectorRenderType|string} The render mode.
	 */
	public getRenderMode() {
		return this.renderMode_;
	}
}
