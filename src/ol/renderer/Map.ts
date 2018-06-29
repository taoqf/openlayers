/**
 * @module ol/renderer/Map
 */
import { Coordinate } from '../coordinate';
import Disposable from '../Disposable';
import { EventsKey, listen, unlistenByKey } from '../events';
import EventType from '../events/EventType';
import { getWidth } from '../extent';
import Feature from '../Feature';
import { getUid, Pixel } from '../index';
import Layer, { LayerState, visibleAtResolution } from '../layer/Layer';
import PluggableMap, { FrameState } from '../PluggableMap';
import RenderFeature from '../render/Feature';
import { shared as iconImageCache } from '../style/IconImageCache';
import { compose as composeTransform, invert as invertTransform, setFromArray as transformSetFromArray } from '../transform';
import LayerRenderer from './Layer';

/**
 * @constructor
 * @abstract
 * @extends {module:ol/Disposable}
 * @param {module:ol/PluggableMap} map Map.
 * @struct
 */
export default abstract class MapRenderer extends Disposable {
	private map_: PluggableMap;
	private layerRenderers_: { [layer: string]: LayerRenderer; };
	private layerRendererListeners_: { [s: string]: EventsKey; };
	private layerRendererConstructors_: LayerRenderer[];
	constructor(map: PluggableMap) {
		super();

		/**
		 * @private
		 * @type {module:ol/PluggableMap}
		 */
		this.map_ = map;

		/**
		 * @private
		 * @type {!Object.<string, module:ol/renderer/Layer>}
		 */
		this.layerRenderers_ = {};

		/**
		 * @private
		 * @type {Object.<string, module:ol/events~EventsKey>}
		 */
		this.layerRendererListeners_ = {};

		/**
		 * @private
		 * @type {Array.<module:ol/renderer/Layer>}
		 */
		this.layerRendererConstructors_ = [];
	}

	/**
	 * Register layer renderer constructors.
	 * @param {Array.<module:ol/renderer/Layer>} constructors Layer renderers.
	 */
	public registerLayerRenderers(constructors: LayerRenderer[]) {
		this.layerRendererConstructors_.push.apply(this.layerRendererConstructors_, constructors);
	}

	/**
	 * Get the registered layer renderer constructors.
	 * @return {Array.<module:ol/renderer/Layer>} Registered layer renderers.
	 */
	public getLayerRendererConstructors() {
		return this.layerRendererConstructors_;
	}

	/**
	 * Removes all layer renderers.
	 */
	public removeLayerRenderers() {
		Object.keys(this.layerRenderers_).forEach((key) => {
			this.removeLayerRendererByKey_(key).dispose();
		});
	}

	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {module:ol/PluggableMap~FrameState} frameState FrameState.
	 * @param {number} hitTolerance Hit tolerance in pixels.
	 * @param {function(this: S, (module:ol/Feature|module:ol/render/Feature),
	 *     module:ol/layer/Layer): T} callback Feature callback.
	 * @param {S} thisArg Value to use as `this` when executing `callback`.
	 * @param {function(this: U, module:ol/layer/Layer): boolean} layerFilter Layer filter
	 *     function, only layers which are visible and for which this function
	 *     returns `true` will be tested for features.  By default, all visible
	 *     layers will be tested.
	 * @param {U} thisArg2 Value to use as `this` when executing `layerFilter`.
	 * @return {T|undefined} Callback result.
	 * @template S,T,U
	 */
	public forEachFeatureAtCoordinate<S, T, U>(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, callback: (this: S, feature: Feature | RenderFeature, layer: Layer) => T, thisArg: S, layerFilter: (this: U, layer: Layer) => boolean, thisArg2: U) {
		let result;
		const viewState = frameState.viewState;
		const viewResolution = viewState.resolution;

		/**
		 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
		 * @param {module:ol/layer/Layer} layer Layer.
		 * @return {?} Callback result.
		 */
		function forEachFeatureAtCoordinate(feature: Feature | RenderFeature, layer: Layer) {
			const key = getUid(feature).toString();
			const managed = frameState.layerStates[getUid(layer)].managed;
			if (!(key in frameState.skippedFeatureUids && !managed)) {
				return callback.call(thisArg, feature, managed ? layer : null);
			}
		}

		const projection = viewState.projection;

		let translatedCoordinate = coordinate;
		if (projection.canWrapX()) {
			const projectionExtent = projection.getExtent()!;
			const worldWidth = getWidth(projectionExtent);
			const x = coordinate[0];
			if (x < projectionExtent[0] || x > projectionExtent[2]) {
				const worldsAway = Math.ceil((projectionExtent[0] - x) / worldWidth);
				translatedCoordinate = [x + worldWidth * worldsAway, coordinate[1]];
			}
		}

		const layerStates = frameState.layerStatesArray;
		const numLayers = layerStates.length;
		let i;
		for (i = numLayers - 1; i >= 0; --i) {
			const layerState = layerStates[i]!;
			const layer = layerState.layer;
			if (visibleAtResolution(layerState, viewResolution) && layerFilter.call(thisArg2, layer)) {
				const layerRenderer = this.getLayerRenderer(layer);
				if (layer.getSource()) {
					result = layerRenderer.forEachFeatureAtCoordinate(
						layer.getSource().getWrapX() ? translatedCoordinate : coordinate,
						frameState, hitTolerance, forEachFeatureAtCoordinate, thisArg);
				}
				if (result) {
					return result;
				}
			}
		}
		return undefined;
	}


	/**
	 * @abstract
	 * @param {module:ol~Pixel} pixel Pixel.
	 * @param {module:ol/PluggableMap~FrameState} frameState FrameState.
	 * @param {function(this: S, module:ol/layer/Layer, (Uint8ClampedArray|Uint8Array)): T} callback Layer
	 *     callback.
	 * @param {S} thisArg Value to use as `this` when executing `callback`.
	 * @param {function(this: U, module:ol/layer/Layer): boolean} layerFilter Layer filter
	 *     function, only layers which are visible and for which this function
	 *     returns `true` will be tested for features.  By default, all visible
	 *     layers will be tested.
	 * @param {U} thisArg2 Value to use as `this` when executing `layerFilter`.
	 * @return {T|undefined} Callback result.
	 * @template S,T,U
	 */
	public abstract forEachLayerAtPixel<S, T, U>(pixel: Pixel, frameState: FrameState, callback: (this: S, layer: Layer, data: (Uint8ClampedArray | Uint8Array)) => T, thisArg: S, layerFilter: (this: U, layer: Layer) => boolean, thisArg2: U): T | undefined | void;


	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {module:ol/PluggableMap~FrameState} frameState FrameState.
	 * @param {number} hitTolerance Hit tolerance in pixels.
	 * @param {function(this: U, module:ol/layer/Layer): boolean} layerFilter Layer filter
	 *     function, only layers which are visible and for which this function
	 *     returns `true` will be tested for features.  By default, all visible
	 *     layers will be tested.
	 * @param {U} thisArg Value to use as `this` when executing `layerFilter`.
	 * @return {boolean} Is there a feature at the given coordinate?
	 * @template U
	 */
	public hasFeatureAtCoordinate<U>(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, layerFilter: (this: U, layer: Layer) => boolean, thisArg: U) {
		const hasFeature = this.forEachFeatureAtCoordinate(
			coordinate, frameState, hitTolerance, () => {
				return true;
			}, this, layerFilter, thisArg);

		return hasFeature !== undefined;
	}

	/**
	 * @return {module:ol/PluggableMap} Map.
	 */
	public getMap() {
		return this.map_;
	}


	/**
	 * Render.
	 * @param {?module:ol/PluggableMap~FrameState} frameState Frame state.
	 */
	public renderFrame(_frameState: FrameState | undefined | null) { }

	/**
	 * @param {module:ol/layer/Layer} layer Layer.
	 * @protected
	 * @return {module:ol/renderer/Layer} Layer renderer.
	 */
	protected getLayerRenderer(layer: Layer) {
		const layerKey = getUid(layer).toString();
		if (layerKey in this.layerRenderers_) {
			return this.layerRenderers_[layerKey];
		} else {
			let renderer;
			for (let i = 0, ii = this.layerRendererConstructors_.length; i < ii; ++i) {
				const candidate = this.layerRendererConstructors_[i];
				if (candidate.handles(layer)) {
					renderer = candidate.create(this, layer);
					break;
				}
			}
			if (renderer) {
				this.layerRenderers_[layerKey] = renderer;
				this.layerRendererListeners_[layerKey] = listen(renderer,
					EventType.CHANGE, this.handleLayerRendererChange_, this)!;
			} else {
				throw new Error('Unable to create renderer for layer: ' + layer.getType());
			}
			return renderer;
		}
	}


	/**
	 * @param {string} layerKey Layer key.
	 * @protected
	 * @return {module:ol/renderer/Layer} Layer renderer.
	 */
	protected getLayerRendererByKey(layerKey: string) {
		return this.layerRenderers_[layerKey];
	}


	/**
	 * @protected
	 * @return {Object.<string, module:ol/renderer/Layer>} Layer renderers.
	 */
	protected getLayerRenderers() {
		return this.layerRenderers_;
	}

	/**
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @protected
	 */
	protected scheduleExpireIconCache(frameState: FrameState) {
		frameState.postRenderFunctions.push(/** @type {module:ol/PluggableMap~PostRenderFunction} */(expireIconCache));
	}


	/**
	 * @param {!module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @protected
	 */
	protected scheduleRemoveUnusedLayerRenderers(frameState: FrameState) {
		for (const layerKey in this.layerRenderers_) {
			if (!(layerKey in frameState.layerStates)) {
				frameState.postRenderFunctions.push(
			/** @type {module:ol/PluggableMap~PostRenderFunction} */(this.removeUnusedLayerRenderers_.bind(this))
				);
				return;
			}
		}
	}

	/**
	 * @param {module:ol/PluggableMap~FrameState} frameState FrameState.
	 * @protected
	 */
	protected calculateMatrices2D(frameState: FrameState) {
		const viewState = frameState.viewState;
		const coordinateToPixelTransform = frameState.coordinateToPixelTransform;
		const pixelToCoordinateTransform = frameState.pixelToCoordinateTransform;

		composeTransform(coordinateToPixelTransform,
			frameState.size[0] / 2, frameState.size[1] / 2,
			1 / viewState.resolution, -1 / viewState.resolution,
			-viewState.rotation,
			-viewState.center[0], -viewState.center[1]);

		invertTransform(
			transformSetFromArray(pixelToCoordinateTransform, coordinateToPixelTransform));
	}
	/**
	 * Handle changes in a layer renderer.
	 * @private
	 */
	private handleLayerRendererChange_() {
		this.map_.render();
	}


	/**
	 * @param {string} layerKey Layer key.
	 * @return {module:ol/renderer/Layer} Layer renderer.
	 * @private
	 */
	private removeLayerRendererByKey_(layerKey: string) {
		const layerRenderer = this.layerRenderers_[layerKey];
		delete this.layerRenderers_[layerKey];

		unlistenByKey(this.layerRendererListeners_[layerKey]);
		delete this.layerRendererListeners_[layerKey];

		return layerRenderer;
	}

	/**
	 * @param {module:ol/PluggableMap} map Map.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @private
	 */
	private removeUnusedLayerRenderers_(_map: PluggableMap, frameState: FrameState) {
		for (const layerKey in this.layerRenderers_) {
			if (!frameState || !(layerKey in frameState.layerStates)) {
				this.removeLayerRendererByKey_(layerKey).dispose();
			}
		}
	}
}

/**
 * @param {module:ol/PluggableMap} map Map.
 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
 */
function expireIconCache(_map: PluggableMap, _frameState: FrameState) {
	iconImageCache.expire();
}

/**
 * @param {module:ol/layer/Layer~State} state1 First layer state.
 * @param {module:ol/layer/Layer~State} state2 Second layer state.
 * @return {number} The zIndex difference.
 */
export function sortByZIndex(state1: LayerState, state2: LayerState) {
	return state1.zIndex - state2.zIndex;
}
