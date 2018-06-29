/**
 * @module ol/renderer/canvas/Map
 */
import { includes, stableSort } from '../../array';
import { CLASS_UNSELECTABLE } from '../../css';
import { createCanvasContext2D } from '../../dom';
import { Pixel } from '../../index';
import Layer, { visibleAtResolution } from '../../layer/Layer';
import Map from '../../Map';
import { FrameState } from '../../PluggableMap';
import { rotateAtOffset } from '../../render/canvas';
import CanvasImmediateRenderer from '../../render/canvas/Immediate';
import RenderEvent from '../../render/Event';
import RenderEventType from '../../render/EventType';
import SourceState from '../../source/State';
import { apply as applyTransform, compose as composeTransform, create as createTransform } from '../../transform';
import LayerRenderer from '../Layer';
import MapRenderer, { sortByZIndex } from '../Map';


/**
 * @type {Array.<module:ol/renderer/Layer>}
 */
export const layerRendererConstructors: LayerRenderer[] = [];


/**
 * @constructor
 * @extends {module:ol/renderer/Map}
 * @param {module:ol/PluggableMap} map Map.
 * @api
 */
export default class CanvasMapRenderer extends MapRenderer {
	public context_: CanvasRenderingContext2D;
	public canvas_: HTMLCanvasElement;
	public renderedVisible_: boolean;
	public transform_: number[];
	constructor(map: Map) {
		super(map);

		const container = map.getViewport();

		/**
		 * @private
		 * @type {CanvasRenderingContext2D}
		 */
		this.context_ = createCanvasContext2D();

		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas_ = this.context_!.canvas;

		this.canvas_.style.width = '100%';
		this.canvas_.style.height = '100%';
		this.canvas_.style.display = 'block';
		this.canvas_.className = CLASS_UNSELECTABLE;
		container.insertBefore(this.canvas_, container.childNodes[0] || null);

		/**
		 * @private
		 * @type {boolean}
		 */
		this.renderedVisible_ = true;

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.transform_ = createTransform();
	}

	/**
	 * @inheritDoc
	 */
	public renderFrame(frameState: FrameState) {

		if (!frameState) {
			if (this.renderedVisible_) {
				this.canvas_.style.display = 'none';
				this.renderedVisible_ = false;
			}
			return;
		}

		const context = this.context_;
		const pixelRatio = frameState.pixelRatio;
		const width = Math.round(frameState.size[0] * pixelRatio);
		const height = Math.round(frameState.size[1] * pixelRatio);
		if (this.canvas_.width !== width || this.canvas_.height !== height) {
			this.canvas_.width = width;
			this.canvas_.height = height;
		} else {
			context.clearRect(0, 0, width, height);
		}

		const rotation = frameState.viewState.rotation;

		this.calculateMatrices2D(frameState);

		this.dispatchComposeEvent_(RenderEventType.PRECOMPOSE, frameState);

		const layerStatesArray = frameState.layerStatesArray;
		stableSort(layerStatesArray, sortByZIndex);

		if (rotation) {
			context.save();
			rotateAtOffset(context, rotation, width / 2, height / 2);
		}

		const viewResolution = frameState.viewState.resolution;
		// let i, ii, layer, layerRenderer, layerState;
		for (let i = 0, ii = layerStatesArray.length; i < ii; ++i) {
			const layerState = layerStatesArray[i];
			const layer = layerState.layer;
			const layerRenderer = /** @type {module:ol/renderer/canvas/Layer} */ (this.getLayerRenderer(layer));
			if (!visibleAtResolution(layerState, viewResolution) ||
				layerState.sourceState !== SourceState.READY) {
				continue;
			}
			if (layerRenderer.prepareFrame(frameState, layerState)) {
				layerRenderer.composeFrame(frameState, layerState, context);
			}
		}

		if (rotation) {
			context.restore();
		}

		this.dispatchComposeEvent_(RenderEventType.POSTCOMPOSE, frameState);

		if (!this.renderedVisible_) {
			this.canvas_.style.display = '';
			this.renderedVisible_ = true;
		}

		this.scheduleRemoveUnusedLayerRenderers(frameState);
		this.scheduleExpireIconCache(frameState);
	}


	/**
	 * @inheritDoc
	 */
	public forEachLayerAtPixel<S, T, U>(pixel: Pixel, frameState: FrameState, callback: (this: S, layer: Layer, data: (Uint8ClampedArray | Uint8Array)) => T, thisArg: S, layerFilter: (this: U, layer: Layer) => boolean, thisArg2: U) {
		let result;
		const viewState = frameState.viewState;
		const viewResolution = viewState.resolution;

		const layerStates = frameState.layerStatesArray;
		const numLayers = layerStates.length;

		const coordinate = applyTransform(
			frameState.pixelToCoordinateTransform, pixel.slice() as Pixel);

		let i;
		for (i = numLayers - 1; i >= 0; --i) {
			const layerState = layerStates[i];
			const layer = layerState.layer;
			if (visibleAtResolution(layerState, viewResolution) && layerFilter.call(thisArg2, layer)) {
				const layerRenderer = /** @type {module:ol/renderer/canvas/Layer} */ (this.getLayerRenderer(layer));
				result = layerRenderer.forEachLayerAtCoordinate(
					coordinate, frameState, callback, thisArg);
				if (result) {
					return result;
				}
			}
		}
		return undefined;
	}


	/**
	 * @inheritDoc
	 */
	public registerLayerRenderers(constructors: LayerRenderer[]) {
		MapRenderer.prototype.registerLayerRenderers.call(this, constructors);
		for (let i = 0, ii = constructors.length; i < ii; ++i) {
			const ctor = constructors[i];
			if (!includes(layerRendererConstructors, ctor)) {
				layerRendererConstructors.push(ctor);
			}
		}
	}

	/**
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @protected
	 * @return {!module:ol/transform~Transform} Transform.
	 */
	protected getTransform(frameState: FrameState) {
		const viewState = frameState.viewState;
		const dx1 = this.canvas_.width / 2;
		const dy1 = this.canvas_.height / 2;
		const sx = frameState.pixelRatio / viewState.resolution;
		const sy = -sx;
		const angle = -viewState.rotation;
		const dx2 = -viewState.center[0];
		const dy2 = -viewState.center[1];
		return composeTransform(this.transform_, dx1, dy1, sx, sy, angle, dx2, dy2);
	}

	/**
	 * @param {module:ol/render/EventType} type Event type.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @private
	 */
	private dispatchComposeEvent_(type: RenderEventType, frameState: FrameState) {
		const map = this.getMap();
		const context = this.context_;
		if (map.hasListener(type)) {
			const extent = frameState.extent;
			const pixelRatio = frameState.pixelRatio;
			const viewState = frameState.viewState;
			const rotation = viewState.rotation;

			const transform = this.getTransform(frameState);

			const vectorContext = new CanvasImmediateRenderer(context, pixelRatio,
				extent, transform, rotation);
			const composeEvent = new RenderEvent(type, vectorContext,
				frameState, context, null!);
			map.dispatchEvent(composeEvent);
		}
	}
}
