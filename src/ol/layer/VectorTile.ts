/**
 * @module ol/layer/VectorTile
 */
import { assert } from '../asserts';
import { Extent } from '../extent';
import TileProperty from '../layer/TileProperty';
import VectorLayer from '../layer/Vector';
import VectorTileRenderType from '../layer/VectorTileRenderType';
import LayerType from '../LayerType';
import { assign } from '../obj';
import PluggableMap from '../PluggableMap';
import { OrderFunction } from '../render';
import VectorTile from '../source/VectorTile';
import Style, { StyleFunction } from '../style/Style';


/**
 * @enum {string}
 * Render mode for vector tiles:
 *  * `'image'`: Vector tiles are rendered as images. Great performance, but
 *    point symbols and texts are always rotated with the view and pixels are
 *    scaled during zoom animations.
 *  * `'hybrid'`: Polygon and line elements are rendered as images, so pixels
 *    are scaled during zoom animations. Point symbols and texts are accurately
 *    rendered as vectors and can stay upright on rotated views.
 *  * `'vector'`: Vector tiles are rendered as vectors. Most accurate rendering
 *    even during animations, but slower performance than the other options.
 * @api
 */
export const enum RenderType {
	IMAGE = 'image',
	HYBRID = 'hybrid',
	VECTOR = 'vector'
}


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
 * @property {number} [renderBuffer=100] The buffer in pixels around the tile extent used by the
 * renderer when getting features from the vector tile for the rendering or hit-detection.
 * Recommended value: Vector tiles are usually generated with a buffer, so this value should match
 * the largest possible buffer of the used tiles. It should be at least the size of the largest
 * point symbol or line width.
 * @property {module:ol/layer/VectorTileRenderType|string} [renderMode='hybrid'] Render mode for vector tiles:
 *  * `'image'`: Vector tiles are rendered as images. Great performance, but point symbols and texts
 *    are always rotated with the view and pixels are scaled during zoom animations.
 *  * `'hybrid'`: Polygon and line elements are rendered as images, so pixels are scaled during zoom
 *    animations. Point symbols and texts are accurately rendered as vectors and can stay upright on
 *    rotated views.
 *  * `'vector'`: Vector tiles are rendered as vectors. Most accurate rendering even during
 *    animations, but slower performance than the other options.
 *
 * When `declutter` is set to `true`, `'hybrid'` will be used instead of `'image'`.
 * @property {module:ol/source/VectorTile} [source] Source.
 * @property {module:ol/PluggableMap} [map] Sets the layer as overlay on a map. The map will not manage
 * this layer in its layers collection, and the layer will be rendered on top. This is useful for
 * temporary layers. The standard way to add a layer to a map and have it managed by the map is to
 * use {@link module:ol/Map#addLayer}.
 * @property {boolean} [declutter=false] Declutter images and text. Decluttering is applied to all
 * image and text styles, and the priority is defined by the z-index of the style. Lower z-index
 * means higher priority. When set to `true`, a `renderMode` of `'image'` will be overridden with
 * `'hybrid'`.
 * @property {module:ol/style/Style|Array.<module:ol/style/Style>|module:ol/style/Style~StyleFunction} [style] Layer style. See
 * {@link module:ol/style} for default style which will be used if this is not defined.
 * @property {number} [maxTilesLoading=16] Maximum number tiles to load simultaneously.
 * @property {boolean} [updateWhileAnimating=false] When set to `true`, feature batches will be
 * recreated during animations. This means that no vectors will be shown clipped, but the setting
 * will have a performance impact for large amounts of vector data. When set to `false`, batches
 * will be recreated when no animation is active.
 * @property {boolean} [updateWhileInteracting=false] When set to `true`, feature batches will be
 * recreated during interactions. See also `updateWhileAnimating`.
 * @property {number} [preload=0] Preload. Load low-resolution tiles up to `preload` levels. `0`
 * means no preloading.
 * @property {boolean} [useInterimTilesOnError=true] Use interim tiles on error.
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
	renderMode: VectorTileRenderType | string;
	source: VectorTile;
	map: PluggableMap;
	declutter: boolean;
	style: Style | Style[] | StyleFunction;
	maxTilesLoading: number;
	updateWhileAnimating: boolean;
	updateWhileInteracting: boolean;
	preload: number;
	useInterimTilesOnError: boolean;
}

/**
 * @classdesc
 * Layer for vector tile data that is rendered client-side.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @constructor
 * @extends {module:ol/layer/Vector}
 * @param {module:ol/layer/VectorTile~Options=} opt_options Options.
 * @api
 */
export default class VectorTileLayer extends VectorLayer {
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options ? opt_options : {};

		let renderMode = options.renderMode || VectorTileRenderType.HYBRID;
		assert(renderMode === undefined ||
			renderMode === VectorTileRenderType.IMAGE ||
			renderMode === VectorTileRenderType.HYBRID ||
			renderMode === VectorTileRenderType.VECTOR,
			28); // `renderMode` must be `'image'`, `'hybrid'` or `'vector'`
		if (options.declutter && renderMode === VectorTileRenderType.IMAGE) {
			renderMode = VectorTileRenderType.HYBRID;
		}
		options.renderMode = renderMode;

		const baseOptions = assign({}, options);

		delete baseOptions.preload;
		delete baseOptions.useInterimTilesOnError;
		super(/** @type {module:ol/layer/Vector~Options} */(baseOptions as any));

		this.setPreload(options.preload ? options.preload : 0);
		this.setUseInterimTilesOnError(options.useInterimTilesOnError !== undefined ?
			options.useInterimTilesOnError : true);

		/**
		 * The layer type.
		 * @protected
		 * @type {module:ol/LayerType}
		 */
		this.type = LayerType.VECTOR_TILE;
	}

	/**
	 * Return the level as number to which we will preload tiles up to.
	 * @return {number} The level to preload tiles up to.
	 * @observable
	 * @api
	 */
	public getPreload() {
		return /** @type {number} */ (this.get(TileProperty.PRELOAD));
	}


	/**
	 * Whether we use interim tiles on error.
	 * @return {boolean} Use interim tiles on error.
	 * @observable
	 * @api
	 */
	public getUseInterimTilesOnError() {
		return /** @type {boolean} */ (this.get(TileProperty.USE_INTERIM_TILES_ON_ERROR));
	}

	/**
	 * Set the level as number to which we will preload tiles up to.
	 * @param {number} preload The level to preload tiles up to.
	 * @observable
	 * @api
	 */
	public setPreload(preload: number) {
		this.set(TileProperty.PRELOAD, preload);
	}


	/**
	 * Set whether we use interim tiles on error.
	 * @param {boolean} useInterimTilesOnError Use interim tiles on error.
	 * @observable
	 * @api
	 */
	public setUseInterimTilesOnError(useInterimTilesOnError: boolean) {
		this.set(TileProperty.USE_INTERIM_TILES_ON_ERROR, useInterimTilesOnError);
	}

	/**
	 * Return the associated {@link module:ol/source/VectorTile vectortilesource} of the layer.
	 * @function
	 * @return {module:ol/source/VectorTile} Source.
	 * @api
	 */
	public getSource() {
		return super.getSource(); // todo: should return as VectorTile;
	}
}
