/**
 * @module ol/renderer/canvas/IntermediateCanvas
 */
import { Coordinate, scale as scaleCoordinate } from '../../coordinate';
import { createCanvasContext2D } from '../../dom';
import { containsExtent, intersects } from '../../extent';
import Feature from '../../Feature';
import { UNDEFINED } from '../../functions';
import Layer, { LayerState } from '../../layer/Layer';
import { FrameState } from '../../PluggableMap';
import RenderFeature from '../../render/Feature';
import { apply as applyTransform, create as createTransform, Transform } from '../../transform';
import CanvasLayerRenderer from '../canvas/Layer';

/**
 * @constructor
 * @abstract
 * @extends {module:ol/renderer/canvas/Layer}
 * @param {module:ol/layer/Layer} layer Layer.
 */
export default abstract class IntermediateCanvasRenderer extends CanvasLayerRenderer {
	protected coordinateToCanvasPixelTransform: Transform;
	protected hitCanvasContext_: CanvasRenderingContext2D | null;
	constructor(layer: Layer) {
		super(layer);
		/**
		 * @protected
		 * @type {module:ol/transform~Transform}
		 */
		this.coordinateToCanvasPixelTransform = createTransform();

		/**
		 * @private
		 * @type {CanvasRenderingContext2D}
		 */
		this.hitCanvasContext_ = null;
	}

	/**
	 * @inheritDoc
	 */
	public composeFrame(frameState: FrameState, layerState: LayerState, context: CanvasRenderingContext2D) {

		this.preCompose(context, frameState);

		const image = this.getImage();
		if (image) {

			// clipped rendering if layer extent is set
			const extent = layerState.extent;
			const clipped = extent !== undefined &&
				!containsExtent(extent, frameState.extent) &&
				intersects(extent, frameState.extent);
			if (clipped) {
				this.clip(context, frameState, /** @type {module:ol/extent~Extent} */(extent));
			}

			const imageTransform = this.getImageTransform();
			// for performance reasons, context.save / context.restore is not used
			// to save and restore the transformation matrix and the opacity.
			// see http://jsperf.com/context-save-restore-versus-variable
			const alpha = context.globalAlpha;
			context.globalAlpha = layerState.opacity;

			// for performance reasons, context.setTransform is only used
			// when the view is rotated. see http://jsperf.com/canvas-transform
			const dx = imageTransform[4];
			const dy = imageTransform[5];
			const dw = image.width * imageTransform[0];
			const dh = image.height * imageTransform[3];
			context.drawImage(image, 0, 0, +image.width, +image.height,
				Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
			context.globalAlpha = alpha;

			if (clipped) {
				context.restore();
			}
		}

		this.postCompose(context, frameState, layerState);
	}


	/**
	 * @abstract
	 * @return {HTMLCanvasElement|HTMLVideoElement|Image} Canvas.
	 */
	public abstract getImage(): HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null | undefined | void;


	/**
	 * @abstract
	 * @return {!module:ol/transform~Transform} Image transform.
	 */
	public abstract getImageTransform(): Transform;


	/**
	 * @inheritDoc
	 */
	public forEachFeatureAtCoordinate<S, T>(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, callback: (this: S, feature: Feature | RenderFeature, layer: Layer) => T, thisArg?: S): T | undefined | void {
		const layer = this.getLayer();
		const source = layer.getSource();
		const resolution = frameState.viewState.resolution;
		const rotation = frameState.viewState.rotation;
		const skippedFeatureUids = frameState.skippedFeatureUids;
		return source.forEachFeatureAtCoordinate(
			coordinate, resolution, rotation, hitTolerance, skippedFeatureUids,
			/**
			 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
			 * @return {?} Callback result.
			 */
			(feature) => {
				return callback.call(thisArg, feature, layer);
			});
	}


	/**
	 * @inheritDoc
	 */
	public forEachLayerAtCoordinate<S, T, U>(coordinate: Coordinate, frameState: FrameState, callback: (this: S, layer: Layer, n: Uint8ClampedArray | Uint8Array) => T, thisArg: S) {
		if (!this.getImage()) {
			return undefined;
		}

		if (this.getLayer().getSource().forEachFeatureAtCoordinate !== UNDEFINED) {
			// for ImageCanvas sources use the original hit-detection logic,
			// so that for example also transparent polygons are detected
			return super.forEachLayerAtCoordinate<S, T, U>(coordinate, frameState, callback, thisArg);
		} else {
			const pixel = applyTransform(this.coordinateToCanvasPixelTransform, coordinate.slice() as Coordinate);
			scaleCoordinate(pixel, frameState.viewState.resolution / this.renderedResolution!);

			if (!this.hitCanvasContext_) {
				this.hitCanvasContext_ = createCanvasContext2D(1, 1);
			}

			this.hitCanvasContext_.clearRect(0, 0, 1, 1);
			this.hitCanvasContext_.drawImage(this.getImage(), pixel[0], pixel[1], 1, 1, 0, 0, 1, 1);

			const imageData = this.hitCanvasContext_.getImageData(0, 0, 1, 1).data;
			if (imageData[3] > 0) {
				return callback.call(thisArg, this.getLayer(), imageData);
			} else {
				return undefined;
			}
		}
	}
}
