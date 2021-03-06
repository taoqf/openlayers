/**
 * @module ol/renderer/canvas/ImageLayer
 */
import { ENABLE_RASTER_REPROJECTION } from '../../reproj/common';
import ImageCanvas from '../../ImageCanvas';
import LayerType from '../../LayerType';
import ViewHint from '../../ViewHint';
import { equals } from '../../array';
import { getHeight, getIntersection, getWidth, isEmpty } from '../../extent';
import VectorRenderType from '../../layer/VectorRenderType';
import { assign } from '../../obj';
import { layerRendererConstructors } from './Map';
import IntermediateCanvasRenderer from '../canvas/IntermediateCanvas';
import { create as createTransform, compose as composeTransform, Transform } from '../../transform';
import ImageLayer from '../../layer/Image';
import VectorLayer from '../../layer/Vector';
import Layer, { LayerState } from '../../layer/Layer';
import MapRenderer from '../Map';
import { FrameState } from '../../PluggableMap';
import { Coordinate } from '../../coordinate';
import Feature from '../../Feature';
import RenderFeature from '../../render/Feature';
import ImageBase from '../../ImageBase';

/**
 * @constructor
 * @extends {module:ol/renderer/canvas/IntermediateCanvas}
 * @param {module:ol/layer/Image|module:ol/layer/Vector} imageLayer Image or vector layer.
 * @api
 */
export default class CanvasImageLayerRenderer extends IntermediateCanvasRenderer {
	private image_: ImageBase | null;
	private imageTransform_: Transform;
	private skippedFeatures_: string[];
	private vectorRenderer_: CanvasVectorLayerRenderer | null;
	constructor(imageLayer: ImageLayer | VectorLayer) {

		super(imageLayer);
		this.image_ = null;
		this.imageTransform_ = createTransform();
		this.skippedFeatures_ = [];

		/**
		 * @private
		 * @type {module:ol/renderer/canvas/VectorLayer}
		 */
		this.vectorRenderer_ = null;

		if (imageLayer.getType() === LayerType.VECTOR) {
			for (let i = 0, ii = layerRendererConstructors.length; i < ii; ++i) {
				const ctor = layerRendererConstructors[i];
				if (ctor !== CanvasImageLayerRenderer && ctor['handles'](imageLayer)) {
					this.vectorRenderer_ = new ctor(imageLayer);
					break;
				}
			}
		}
	}

	/**
	 * Determine if this renderer handles the provided layer.
	 * @param {module:ol/layer/Layer} layer The candidate layer.
	 * @return {boolean} The renderer can render the layer.
	 */
	public handles(layer: Layer) {
		return layer.getType() === LayerType.IMAGE ||
			layer.getType() === LayerType.VECTOR &&
		/** @type {module:ol/layer/Vector} */ (layer as VectorLayer).getRenderMode() === VectorRenderType.IMAGE;
	}


	/**
	 * Create a layer renderer.
	 * @param {module:ol/renderer/Map} mapRenderer The map renderer.
	 * @param {module:ol/layer/Layer} layer The layer to be rendererd.
	 * @return {module:ol/renderer/canvas/ImageLayer} The layer renderer.
	 */
	public create(_mapRenderer: MapRenderer, layer: Layer) {
		return new CanvasImageLayerRenderer(/** @type {module:ol/layer/Image} */(layer as ImageLayer));
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		if (this.vectorRenderer_) {
			this.vectorRenderer_.dispose();
		}
		super.disposeInternal();
	}


	/**
	 * @inheritDoc
	 */
	public getImage() {
		return !this.image_ ? null : this.image_.getImage();
	}


	/**
	 * @inheritDoc
	 */
	public getImageTransform() {
		return this.imageTransform_;
	}


	/**
	 * @inheritDoc
	 */
	public prepareFrame(frameState: FrameState, layerState: LayerState) {

		const pixelRatio = frameState.pixelRatio;
		const size = frameState.size;
		const viewState = frameState.viewState;
		const viewCenter = viewState.center;
		const viewResolution = viewState.resolution;

		let image;
		const imageLayer = /** @type {module:ol/layer/Image} */ (this.getLayer());
		const imageSource = imageLayer.getSource();

		const hints = frameState.viewHints;

		const vectorRenderer = this.vectorRenderer_;
		let renderedExtent = frameState.extent;
		if (!vectorRenderer && layerState.extent !== undefined) {
			renderedExtent = getIntersection(renderedExtent, layerState.extent);
		}

		if (!hints[ViewHint.ANIMATING] && !hints[ViewHint.INTERACTING] &&
			!isEmpty(renderedExtent)) {
			let projection = viewState.projection;
			if (!ENABLE_RASTER_REPROJECTION) {
				const sourceProjection = imageSource.getProjection();
				if (sourceProjection) {
					projection = sourceProjection;
				}
			}
			let skippedFeatures = this.skippedFeatures_;
			if (vectorRenderer) {
				const context = vectorRenderer.context;
				const imageFrameState = /** @type {module:ol/PluggableMap~FrameState} */ (assign({}, frameState, {
					size: [
						getWidth(renderedExtent) / viewResolution,
						getHeight(renderedExtent) / viewResolution
					],
					viewState: /** @type {module:ol/View~State} */ (assign({}, frameState.viewState, {
						rotation: 0
					}))
				}));
				const newSkippedFeatures = Object.keys(imageFrameState.skippedFeatureUids).sort();
				image = new ImageCanvas(renderedExtent, viewResolution, pixelRatio, context.canvas, function (callback) {
					if (vectorRenderer.prepareFrame(imageFrameState, layerState) &&
						(vectorRenderer.replayGroupChanged ||
							!equals(skippedFeatures, newSkippedFeatures))) {
						context.canvas.width = imageFrameState.size[0] * pixelRatio;
						context.canvas.height = imageFrameState.size[1] * pixelRatio;
						vectorRenderer.compose(context, imageFrameState, layerState);
						skippedFeatures = newSkippedFeatures;
						callback();
					}
				});
			} else {
				image = imageSource.getImage(
					renderedExtent, viewResolution, pixelRatio, projection);
			}
			if (image && this.loadImage(image)) {
				this.image_ = image;
				this.skippedFeatures_ = skippedFeatures;
			}
		}

		if (this.image_) {
			image = this.image_;
			const imageExtent = image.getExtent();
			const imageResolution = image.getResolution();
			const imagePixelRatio = image.getPixelRatio();
			const scale = pixelRatio * imageResolution /
				(viewResolution * imagePixelRatio);
			const transform = composeTransform(this.imageTransform_,
				pixelRatio * size[0] / 2, pixelRatio * size[1] / 2,
				scale, scale,
				0,
				imagePixelRatio * (imageExtent[0] - viewCenter[0]) / imageResolution,
				imagePixelRatio * (viewCenter[1] - imageExtent[3]) / imageResolution);
			composeTransform(this.coordinateToCanvasPixelTransform,
				pixelRatio * size[0] / 2 - transform[4], pixelRatio * size[1] / 2 - transform[5],
				pixelRatio / viewResolution, -pixelRatio / viewResolution,
				0,
				-viewCenter[0], -viewCenter[1]);

			this.renderedResolution = imageResolution * pixelRatio / imagePixelRatio;
		}

		return !!this.image_;
	}


	/**
	 * @inheritDoc
	 */
	public forEachFeatureAtCoordinate<S, T>(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, callback: (this: S, feature: Feature | RenderFeature, layer: Layer) => T, thisArg?: S): T | undefined | void {
		if (this.vectorRenderer_) {
			return this.vectorRenderer_.forEachFeatureAtCoordinate(coordinate, frameState, hitTolerance, callback, thisArg);
		} else {
			return IntermediateCanvasRenderer.prototype.forEachFeatureAtCoordinate.call(this, coordinate, frameState, hitTolerance, callback, thisArg);
		}
	}
}
