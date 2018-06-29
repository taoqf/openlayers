/**
 * @module ol/renderer/canvas/VectorLayer
 */
import rbush from 'rbush';
import { Coordinate } from '../../coordinate';
import { createCanvasContext2D } from '../../dom';
import { listen, unlisten } from '../../events';
import Event from '../../events/Event';
import EventType from '../../events/EventType';
import { buffer, containsExtent, createEmpty, Extent, getWidth } from '../../extent';
import Feature from '../../Feature';
import { getUid } from '../../index';
import Layer, { LayerState } from '../../layer/Layer';
import VectorLayer from '../../layer/Vector';
import LayerType from '../../LayerType';
import { FrameState } from '../../PluggableMap';
import { labelCache, rotateAtOffset } from '../../render/canvas';
import CanvasReplayGroup from '../../render/canvas/ReplayGroup';
import RenderEventType from '../../render/EventType';
import RenderFeature from '../../render/Feature';
import ReplayGroup from '../../render/ReplayGroup';
import Style from '../../style/Style';
import ViewHint from '../../ViewHint';
import CanvasLayerRenderer from '../canvas/Layer';
import MapRenderer from '../Map';
import { defaultOrder as defaultRenderOrder, getSquaredTolerance as getSquaredRenderTolerance, getTolerance as getRenderTolerance, renderFeature } from '../vector';

/**
 * @constructor
 * @extends {module:ol/renderer/canvas/Layer}
 * @param {module:ol/layer/Vector} vectorLayer Vector layer.
 * @api
 */
export default class CanvasVectorLayerRenderer extends CanvasLayerRenderer {
	public replayGroupChanged: boolean;
	public context: CanvasRenderingContext2D;
	private declutterTree_: rbush.RBush<{ maxX: number; maxY: number; minX: number; minY: number; value: Feature | RenderFeature; }>;
	private dirty_: boolean;
	private renderedRevision_: number;
	private renderedResolution_: number;
	private renderedExtent_: Extent;
	private renderedRenderOrder_: ((feature1: Feature, feature2: Feature) => number | null) | null;
	private replayGroup_: CanvasReplayGroup | null;
	constructor(vectorLayer: VectorLayer) {

		super(vectorLayer);

		/**
		 * Declutter tree.
		 * @private
		 */
		this.declutterTree_ = vectorLayer.getDeclutter() ? rbush<{ maxX: number; maxY: number; minX: number; minY: number; value: Feature | RenderFeature; }>(9, undefined!) : null!;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.dirty_ = false;

		/**
		 * @private
		 * @type {number}
		 */
		this.renderedRevision_ = -1;

		/**
		 * @private
		 * @type {number}
		 */
		this.renderedResolution_ = NaN;

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.renderedExtent_ = createEmpty();

		/**
		 * @private
		 * @type {function(module:ol/Feature, module:ol/Feature): number|null}
		 */
		this.renderedRenderOrder_ = null;

		/**
		 * @private
		 * @type {module:ol/render/canvas/ReplayGroup}
		 */
		this.replayGroup_ = null;

		/**
		 * A new replay group had to be created by `prepareFrame()`
		 * @type {boolean}
		 */
		this.replayGroupChanged = true;

		/**
		 * @type {CanvasRenderingContext2D}
		 */
		this.context = createCanvasContext2D();

		listen(labelCache, EventType.CLEAR, this.handleFontsChanged_, this);

	}

	/**
	 * Determine if this renderer handles the provided layer.
	 * @param {module:ol/layer/Layer} layer The candidate layer.
	 * @return {boolean} The renderer can render the layer.
	 */
	public handles(layer: Layer) {
		return layer.getType() === LayerType.VECTOR;
	}


	/**
	 * Create a layer renderer.
	 * @param {module:ol/renderer/Map} mapRenderer The map renderer.
	 * @param {module:ol/layer/Layer} layer The layer to be rendererd.
	 * @return {module:ol/renderer/canvas/VectorLayer} The layer renderer.
	 */
	public create(_mapRenderer: MapRenderer, layer: Layer) {
		return new CanvasVectorLayerRenderer(/** @type {module:ol/layer/Vector} */(layer as VectorLayer));
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		unlisten(labelCache, EventType.CLEAR, this.handleFontsChanged_, this);
		super.disposeInternal();
	}


	/**
	 * @param {CanvasRenderingContext2D} context Context.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @param {module:ol/layer/Layer~State} layerState Layer state.
	 */
	public compose(context: CanvasRenderingContext2D, frameState: FrameState, layerState: LayerState) {
		const extent = frameState.extent;
		const pixelRatio = frameState.pixelRatio;
		const skippedFeatureUids = layerState.managed ?
			frameState.skippedFeatureUids : {};
		const viewState = frameState.viewState;
		const projection = viewState.projection;
		const rotation = viewState.rotation;
		const projectionExtent = projection.getExtent();
		const vectorSource = /** @type {module:ol/source/Vector} */ (this.getLayer().getSource());

		let transform = this.getTransform(frameState, 0);

		// clipped rendering if layer extent is set
		const clipExtent = layerState.extent;
		const clipped = clipExtent !== undefined;
		if (clipped) {
			this.clip(context, frameState,  /** @type {module:ol/extent~Extent} */(clipExtent));
		}
		const replayGroup = this.replayGroup_;
		if (replayGroup && !replayGroup.isEmpty()) {
			if (this.declutterTree_) {
				this.declutterTree_.clear();
			}
			const layer = /** @type {module:ol/layer/Vector} */ (this.getLayer());
			let drawOffsetX = 0;
			let drawOffsetY = 0;
			let replayContext;
			const transparentLayer = layerState.opacity !== 1;
			const hasRenderListeners = layer.hasListener(RenderEventType.RENDER);
			if (transparentLayer || hasRenderListeners) {
				let drawWidth = context.canvas.width;
				let drawHeight = context.canvas.height;
				if (rotation) {
					const drawSize = Math.round(Math.sqrt(drawWidth * drawWidth + drawHeight * drawHeight));
					drawOffsetX = (drawSize - drawWidth) / 2;
					drawOffsetY = (drawSize - drawHeight) / 2;
					drawWidth = drawHeight = drawSize;
				}
				// resize and clear
				this.context.canvas.width = drawWidth;
				this.context.canvas.height = drawHeight;
				replayContext = this.context;
			} else {
				replayContext = context;
			}

			const alpha = replayContext.globalAlpha;
			if (!transparentLayer) {
				// for performance reasons, context.save / context.restore is not used
				// to save and restore the transformation matrix and the opacity.
				// see http://jsperf.com/context-save-restore-versus-variable
				replayContext.globalAlpha = layerState.opacity;
			}

			if (replayContext !== context) {
				replayContext.translate(drawOffsetX, drawOffsetY);
			}

			const width = frameState.size[0] * pixelRatio;
			const height = frameState.size[1] * pixelRatio;
			rotateAtOffset(replayContext, -rotation,
				width / 2, height / 2);
			replayGroup.replay(replayContext, transform, rotation, skippedFeatureUids);
			if (vectorSource.getWrapX() && projection.canWrapX() &&
				!containsExtent(projectionExtent!, extent)) {
				let startX = extent[0];
				const worldWidth = getWidth(projectionExtent!);
				let world = 0;
				let offsetX;
				while (startX < projectionExtent![0]) {
					--world;
					offsetX = worldWidth * world;
					transform = this.getTransform(frameState, offsetX);
					replayGroup.replay(replayContext, transform, rotation, skippedFeatureUids);
					startX += worldWidth;
				}
				world = 0;
				startX = extent[2];
				while (startX > projectionExtent![2]) {
					++world;
					offsetX = worldWidth * world;
					transform = this.getTransform(frameState, offsetX);
					replayGroup.replay(replayContext, transform, rotation, skippedFeatureUids);
					startX -= worldWidth;
				}
			}
			rotateAtOffset(replayContext, rotation,
				width / 2, height / 2);

			if (replayContext !== context) {
				if (hasRenderListeners) {
					this.dispatchRenderEvent(replayContext, frameState, transform);
				}
				if (transparentLayer) {
					const mainContextAlpha = context.globalAlpha;
					context.globalAlpha = layerState.opacity;
					context.drawImage(replayContext.canvas, -drawOffsetX, -drawOffsetY);
					context.globalAlpha = mainContextAlpha;
				} else {
					context.drawImage(replayContext.canvas, -drawOffsetX, -drawOffsetY);
				}
				replayContext.translate(-drawOffsetX, -drawOffsetY);
			}

			if (!transparentLayer) {
				replayContext.globalAlpha = alpha;
			}
		}

		if (clipped) {
			context.restore();
		}
	}


	/**
	 * @inheritDoc
	 */
	public composeFrame(frameState: FrameState, layerState: LayerState, context: CanvasRenderingContext2D) {
		const transform = this.getTransform(frameState, 0);
		this.preCompose(context, frameState, transform);
		this.compose(context, frameState, layerState);
		this.postCompose(context, frameState, layerState, transform);
	}


	/**
	 * @inheritDoc
	 */
	public forEachFeatureAtCoordinate<S, T>(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, callback: (this: S, feature: Feature | RenderFeature, layer: Layer) => T, thisArg?: S): T | undefined | void {
		if (!this.replayGroup_) {
			return undefined;
		} else {
			const resolution = frameState.viewState.resolution;
			const rotation = frameState.viewState.rotation;
			const layer = /** @type {module:ol/layer/Vector} */ (this.getLayer());
			/** @type {!Object.<string, boolean>} */
			const features = {} as { [id: string]: boolean; };
			const result = this.replayGroup_.forEachFeatureAtCoordinate(coordinate, resolution, rotation, hitTolerance, {},
				/**
				 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
				 * @return {?} Callback result.
				 */
				(feature: Feature | RenderFeature) => {
					const key = getUid(feature).toString();
					if (!(key in features)) {
						features[key] = true;
						return callback.call(thisArg, feature, layer);
					}
				}, null!);
			return result;
		}
	}

	/**
	 * @inheritDoc
	 */
	public prepareFrame(frameState: FrameState, _layerState: LayerState) {
		const vectorLayer = /** @type {module:ol/layer/Vector} */ (this.getLayer() as VectorLayer);
		const vectorSource = vectorLayer.getSource();

		const animating = frameState.viewHints[ViewHint.ANIMATING];
		const interacting = frameState.viewHints[ViewHint.INTERACTING];
		const updateWhileAnimating = vectorLayer.getUpdateWhileAnimating();
		const updateWhileInteracting = vectorLayer.getUpdateWhileInteracting();

		if (!this.dirty_ && (!updateWhileAnimating && animating) ||
			(!updateWhileInteracting && interacting)) {
			return true;
		}

		const frameStateExtent = frameState.extent;
		const viewState = frameState.viewState;
		const projection = viewState.projection;
		const resolution = viewState.resolution;
		const pixelRatio = frameState.pixelRatio;
		const vectorLayerRevision = vectorLayer.getRevision();
		const vectorLayerRenderBuffer = vectorLayer.getRenderBuffer();
		let vectorLayerRenderOrder = vectorLayer.getRenderOrder();

		if (vectorLayerRenderOrder === undefined) {
			vectorLayerRenderOrder = defaultRenderOrder;
		}

		const extent = buffer(frameStateExtent,
			vectorLayerRenderBuffer * resolution);
		const projectionExtent = viewState.projection.getExtent();

		if (vectorSource.getWrapX() && viewState.projection.canWrapX() &&
			!containsExtent(projectionExtent!, frameState.extent)) {
			// For the replay group, we need an extent that intersects the real world
			// (-180° to +180°). To support geometries in a coordinate range from -540°
			// to +540°, we add at least 1 world width on each side of the projection
			// extent. If the viewport is wider than the world, we need to add half of
			// the viewport width to make sure we cover the whole viewport.
			const worldWidth = getWidth(projectionExtent!);
			const gutter = Math.max(getWidth(extent) / 2, worldWidth);
			extent[0] = projectionExtent![0] - gutter;
			extent[2] = projectionExtent![2] + gutter;
		}

		if (!this.dirty_ &&
			this.renderedResolution_ === resolution &&
			this.renderedRevision_ === vectorLayerRevision &&
			this.renderedRenderOrder_ === vectorLayerRenderOrder &&
			containsExtent(this.renderedExtent_, extent)) {
			this.replayGroupChanged = false;
			return true;
		}

		this.replayGroup_ = null;

		this.dirty_ = false;

		const replayGroup = new CanvasReplayGroup(
			getRenderTolerance(resolution, pixelRatio), extent, resolution,
			pixelRatio, vectorSource.getOverlaps(), this.declutterTree_, vectorLayer.getRenderBuffer());
		vectorSource.loadFeatures(extent, resolution, projection);
		/**
		 * @param {module:ol/Feature} feature Feature.
		 * @this {module:ol/renderer/canvas/VectorLayer}
		 */
		const render = (feature: Feature) => {
			let styles;
			const styleFunction = feature.getStyleFunction() || vectorLayer.getStyleFunction();
			if (styleFunction) {
				styles = styleFunction(feature, resolution);
			}
			if (styles) {
				const dirty = this.renderFeature(
					feature, resolution, pixelRatio, styles, replayGroup);
				this.dirty_ = this.dirty_ || dirty;
			}
		};
		if (vectorLayerRenderOrder) {
			/** @type {Array.<module:ol/Feature>} */
			const features: Feature[] = [];
			vectorSource.forEachFeatureInExtent(extent, (feature) => {
				features.push(feature);
			}, this);
			features.sort(vectorLayerRenderOrder);
			for (let i = 0, ii = features.length; i < ii; ++i) {
				render(features[i]);
			}
		} else {
			vectorSource.forEachFeatureInExtent(extent, render, this);
		}
		replayGroup.finish();

		this.renderedResolution_ = resolution;
		this.renderedRevision_ = vectorLayerRevision;
		this.renderedRenderOrder_ = vectorLayerRenderOrder;
		this.renderedExtent_ = extent;
		this.replayGroup_ = replayGroup;

		this.replayGroupChanged = true;
		return true;
	}


	/**
	 * @param {module:ol/Feature} feature Feature.
	 * @param {number} resolution Resolution.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {(module:ol/style/Style|Array.<module:ol/style/Style>)} styles The style or array of styles.
	 * @param {module:ol/render/canvas/ReplayGroup} replayGroup Replay group.
	 * @return {boolean} `true` if an image is loading.
	 */
	public renderFeature(feature: Feature, resolution: number, pixelRatio: number, styles: Style | Style[], replayGroup: ReplayGroup) {
		if (!styles) {
			return false;
		}
		let loading = false;
		if (Array.isArray(styles)) {
			for (let i = 0, ii = styles.length; i < ii; ++i) {
				loading = renderFeature(
					replayGroup, feature, styles[i],
					getSquaredRenderTolerance(resolution, pixelRatio),
					this.handleStyleImageChange_, this) || loading;
			}
		} else {
			loading = renderFeature(
				replayGroup, feature, styles,
				getSquaredRenderTolerance(resolution, pixelRatio),
				this.handleStyleImageChange_, this);
		}
		return loading;
	}

	/**
	 * @param {module:ol/events/Event} event Event.
	 */
	private handleFontsChanged_(_event: Event) {
		const layer = this.getLayer();
		if (layer.getVisible() && this.replayGroup_) {
			layer.changed();
		}
	}


	/**
	 * Handle changes in image style state.
	 * @param {module:ol/events/Event} event Image style change event.
	 * @private
	 */
	private handleStyleImageChange_(_event: Event) {
		this.renderIfReadyAndVisible();
	}
}
