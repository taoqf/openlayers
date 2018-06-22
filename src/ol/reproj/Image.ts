/**
 * @module ol/reproj/Image
 */
import { EventsKey, listen, unlistenByKey } from '../events';
import EventType from '../events/EventType';
import { Extent, getCenter, getHeight, getIntersection, getWidth } from '../extent';
import ImageBase from '../ImageBase';
import ImageState from '../ImageState';
import Projection from '../proj/Projection';
import { calculateSourceResolution, render as renderReprojected } from '../reproj';
import Triangulation from '../reproj/Triangulation';
import { ERROR_THRESHOLD } from './common';


/**
 * @typedef {function(module:ol/extent~Extent, number, number) : module:ol/ImageBase} FunctionType
 */

export type FunctionType = (extent: Extent, w: number, h: number) => ImageBase;

/**
 * @classdesc
 * Class encapsulating single reprojected image.
 * See {@link module:ol/source/Image~ImageSource}.
 *
 * @constructor
 * @extends {module:ol/ImageBase}
 * @param {module:ol/proj/Projection} sourceProj Source projection (of the data).
 * @param {module:ol/proj/Projection} targetProj Target projection.
 * @param {module:ol/extent~Extent} targetExtent Target extent.
 * @param {number} targetResolution Target resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {module:ol/reproj/Image~FunctionType} getImageFunction
 *     Function returning source images (extent, resolution, pixelRatio).
 */
export default class ReprojImage extends ImageBase {
	private targetProj_: Projection;
	private maxSourceExtent_: [number, number, number, number] | null;
	private triangulation_: any;
	private targetResolution_: number;
	private targetExtent_: [number, number, number, number];
	private sourceImage_: ImageBase;
	private sourcePixelRatio_: any;
	private canvas_: HTMLCanvasElement | null;
	private sourceListenerKey_: EventsKey | null | undefined;
	constructor(sourceProj: Projection, targetProj: Projection, targetExtent: Extent, targetResolution: number, pixelRatio: number, getImageFunction: FunctionType) {
		const maxSourceExtent_ = sourceProj.getExtent();
		const maxTargetExtent = targetProj.getExtent();

		const limitedTargetExtent = maxTargetExtent ?
			getIntersection(targetExtent, maxTargetExtent) : targetExtent;

		const targetCenter = getCenter(limitedTargetExtent);
		const sourceResolution = calculateSourceResolution(
			sourceProj, targetProj, targetCenter, targetResolution);

		const errorThresholdInPixels = ERROR_THRESHOLD;

		const triangulation_ = new Triangulation(sourceProj, targetProj, limitedTargetExtent, maxSourceExtent_!, sourceResolution * errorThresholdInPixels);

		const sourceExtent = triangulation_.calculateSourceExtent();

		const sourceImage_ =
			getImageFunction(sourceExtent, sourceResolution, pixelRatio);

		const sourcePixelRatio_ =
			sourceImage_ ? sourceImage_.getPixelRatio() : 1;

		let state = ImageState.LOADED;

		if (sourceImage_) {
			state = ImageState.IDLE;
		}

		super(targetExtent, targetResolution, sourcePixelRatio_, state);

		/**
		 * @private
		 * @type {module:ol/proj/Projection}
		 */
		this.targetProj_ = targetProj;
		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.maxSourceExtent_ = maxSourceExtent_;
		/**
		 * @private
		 * @type {!module:ol/reproj/Triangulation}
		 */
		this.triangulation_ = triangulation_;

		/**
		 * @private
		 * @type {number}
		 */
		this.targetResolution_ = targetResolution;

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.targetExtent_ = targetExtent;
		/**
		 * @private
		 * @type {module:ol/ImageBase}
		 */
		this.sourceImage_ = sourceImage_;
		/**
		 * @private
		 * @type {number}
		 */
		this.sourcePixelRatio_ = sourcePixelRatio_;
		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas_ = null;

		/**
		 * @private
		 * @type {?module:ol/events~EventsKey}
		 */
		this.sourceListenerKey_ = null;
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		if (this.state === ImageState.LOADING) {
			this.unlistenSource_();
		}
		ImageBase.prototype.disposeInternal.call(this);
	}


	/**
	 * @inheritDoc
	 */
	public getImage() {
		return this.canvas_;
	}


	/**
	 * @return {module:ol/proj/Projection} Projection.
	 */
	public getProjection() {
		return this.targetProj_;
	}

	/**
	 * @inheritDoc
	 */
	public load() {
		if (this.state === ImageState.IDLE) {
			this.state = ImageState.LOADING;
			this.changed();

			const sourceState = this.sourceImage_.getState();
			if (sourceState === ImageState.LOADED || sourceState === ImageState.ERROR) {
				this.reproject_();
			} else {
				this.sourceListenerKey_ = listen(this.sourceImage_,
					EventType.CHANGE, () => {
						const source_state = this.sourceImage_.getState();
						if (source_state === ImageState.LOADED || source_state === ImageState.ERROR) {
							this.unlistenSource_();
							this.reproject_();
						}
					}, this);
				this.sourceImage_.load();
			}
		}
	}


	/**
	 * @private
	 */
	private unlistenSource_() {
		unlistenByKey(/** @type {!module:ol/events~EventsKey} */(this.sourceListenerKey_!));
		this.sourceListenerKey_ = null;
	}

	/**
	 * @private
	 */
	private reproject_() {
		const sourceState = this.sourceImage_.getState();
		if (sourceState === ImageState.LOADED) {
			const width = getWidth(this.targetExtent_) / this.targetResolution_;
			const height = getHeight(this.targetExtent_) / this.targetResolution_;

			this.canvas_ = renderReprojected(width, height, this.sourcePixelRatio_, this.sourceImage_.getResolution()!, this.maxSourceExtent_!, this.targetResolution_, this.targetExtent_, this.triangulation_, [{
				extent: this.sourceImage_.getExtent(),
				image: this.sourceImage_.getImage()!
			}], 0);
		}
		this.state = sourceState;
		this.changed();
	}
}
