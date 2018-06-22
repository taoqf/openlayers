/**
 * @module ol/layer/Tile
 */
import { Extent } from '../extent';
import Layer from '../layer/Layer';
import TileProperty from '../layer/TileProperty';
import LayerType from '../LayerType';
import { assign } from '../obj';
import PluggableMap from '../PluggableMap';
import TileSource from '../source/Tile';


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
 * @property {number} [preload=0] Preload. Load low-resolution tiles up to `preload` levels. `0`
 * means no preloading.
 * @property {module:ol/source/Tile} [source] Source for this layer.
 * @property {module:ol/PluggableMap} [map] Sets the layer as overlay on a map. The map will not manage
 * this layer in its layers collection, and the layer will be rendered on top. This is useful for
 * temporary layers. The standard way to add a layer to a map and have it managed by the map is to
 * use {@link module:ol/Map#addLayer}.
 * @property {boolean} [useInterimTilesOnError=true] Use interim tiles on error.
 */

export interface Options {
	opacity: number;
	visible: boolean;
	extent: Extent;
	zIndex: number;
	minResolution: number;
	maxResolution: number;
	preload: number;
	source: TileSource;
	map: PluggableMap;
	useInterimTilesOnError: boolean;
}

/**
 * @classdesc
 * For layer sources that provide pre-rendered, tiled images in grids that are
 * organized by zoom levels for specific resolutions.
 * Note that any property set in the options is set as a {@link module:ol/Object~BaseObject}
 * property on the layer object; for example, setting `title: 'My Title'` in the
 * options means that `title` is observable, and has get/set accessors.
 *
 * @constructor
 * @extends {module:ol/layer/Layer}
 * @fires module:ol/render/Event~RenderEvent
 * @param {module:ol/layer/Tile~Options=} opt_options Tile layer options.
 * @api
 */
export default class TileLayer extends Layer {
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options ? opt_options : {};

		const baseOptions = assign({}, options);

		delete baseOptions.preload;
		delete baseOptions.useInterimTilesOnError;
		super(/** @type {module:ol/layer/Layer~Options} */(baseOptions));

		this.setPreload(options.preload !== undefined ? options.preload : 0);
		this.setUseInterimTilesOnError(options.useInterimTilesOnError !== undefined ?
			options.useInterimTilesOnError : true);

		/**
		 * The layer type.
		 * @protected
		 * @type {module:ol/LayerType}
		 */
		this.type = LayerType.TILE;
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
	 * Return the associated {@link module:ol/source/Tile tilesource} of the layer.
	 * @function
	 * @return {module:ol/source/Tile} Source.
	 * @api
	 */
	public getSource() {
		return super.getSource() as TileSource;
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
	 * Whether we use interim tiles on error.
	 * @return {boolean} Use interim tiles on error.
	 * @observable
	 * @api
	 */
	public getUseInterimTilesOnError() {
		return /** @type {boolean} */ (this.get(TileProperty.USE_INTERIM_TILES_ON_ERROR));
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
}
