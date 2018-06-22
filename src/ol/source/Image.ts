/**
 * @module ol/source/Image
 */
import { linearFindNearest } from '../array';
import Event from '../events/Event';
import { equals, Extent } from '../extent';
import Image from '../Image';
import ImageBase from '../ImageBase';
import ImageState from '../ImageState';
import { equivalent, ProjectionLike } from '../proj';
import Projection from '../proj/Projection';
import { ENABLE_RASTER_REPROJECTION } from '../reproj/common';
import ReprojImage from '../reproj/Image';
import Source, { AttributionLike } from '../source/Source';
import SourceState from './State';


/**
 * @enum {string}
 */
enum ImageSourceEventType {
	/**
	 * Triggered when an image starts loading.
	 * @event ol/source/Image~ImageSourceEvent#imageloadstart
	 * @api
	 */
	IMAGELOADSTART = 'imageloadstart',

	/**
	 * Triggered when an image finishes loading.
	 * @event ol/source/Image~ImageSourceEvent#imageloadend
	 * @api
	 */
	IMAGELOADEND = 'imageloadend',

	/**
	 * Triggered if image loading results in an error.
	 * @event ol/source/Image~ImageSourceEvent#imageloaderror
	 * @api
	 */
	IMAGELOADERROR = 'imageloaderror'
}


/**
 * @classdesc
 * Events emitted by {@link module:ol/source/Image~ImageSource} instances are instances of this
 * type.
 *
 * @constructor
 * @extends {module:ol/events/Event}
 * @param {string} type Type.
 * @param {module:ol/Image} image The image.
 */
class ImageSourceEvent extends Event {
	public image: Image;
	constructor(type: string, image: Image) {
		super(type);

		/**
		 * The image related to the event.
		 * @type {module:ol/Image}
		 * @api
		 */
		this.image = image;
	}
}

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions]
 * @property {module:ol/extent~Extent} [extent]
 * @property {module:ol/proj~ProjectionLike} projection
 * @property {Array.<number>} [resolutions]
 * @property {module:ol/source/State} [state]
 */

export interface Options {
	attributions: AttributionLike;
	// extent: Extent;	// todo ? do we really need this?
	projection: ProjectionLike;
	resolutions: number[];
	state: SourceState;
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for sources providing a single image.
 *
 * @constructor
 * @abstract
 * @extends {module:ol/source/Source}
 * @param {module:ol/source/Image~Options} options Single image source options.
 * @api
 */
export default abstract class ImageSource extends Source {
	private resolutions_: number[] | null;
	private reprojectedImage_: ReprojImage | null;
	private reprojectedRevision_: number;
	constructor(options: Partial<Options>) {
		super({
			attributions: options.attributions,
			// extent: options.extent,
			projection: options.projection,
			state: options.state
		});

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.resolutions_ = options.resolutions !== undefined ?
			options.resolutions : null;


		/**
		 * @private
		 * @type {module:ol/reproj/Image}
		 */
		this.reprojectedImage_ = null;


		/**
		 * @private
		 * @type {number}
		 */
		this.reprojectedRevision_ = 0;
	}

	/**
	 * @return {Array.<number>} Resolutions.
	 * @override
	 */
	public getResolutions() {
		return this.resolutions_;
	}

	/**
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} resolution Resolution.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {module:ol/proj/Projection} projection Projection.
	 * @return {module:ol/ImageBase} Single image.
	 */
	public getImage(extent: Extent, resolution: number, pixelRatio: number, projection: Projection) {
		const sourceProjection = this.getProjection();
		if (!ENABLE_RASTER_REPROJECTION ||
			!sourceProjection ||
			!projection ||
			equivalent(sourceProjection, projection)) {
			if (sourceProjection) {
				projection = sourceProjection;
			}
			return this.getImageInternal(extent, resolution, pixelRatio, projection);
		} else {
			if (this.reprojectedImage_) {
				if (this.reprojectedRevision_ === this.getRevision() &&
					equivalent(
						this.reprojectedImage_.getProjection(), projection) &&
					this.reprojectedImage_.getResolution() === resolution &&
					equals(this.reprojectedImage_.getExtent(), extent)) {
					return this.reprojectedImage_;
				}
				this.reprojectedImage_.dispose();
				this.reprojectedImage_ = null;
			}

			this.reprojectedImage_ = new ReprojImage(
				sourceProjection, projection, extent, resolution, pixelRatio, (e, r, p) => {
					return this.getImageInternal(e, r,
						p, sourceProjection);
				});
			this.reprojectedRevision_ = this.getRevision();

			return this.reprojectedImage_;
		}
	}


	/**
	 * @abstract
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} resolution Resolution.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {module:ol/proj/Projection} projection Projection.
	 * @return {module:ol/ImageBase} Single image.
	 * @protected
	 */
	protected abstract getImageInternal(extent: Extent, resolution: number, pixelRatio: number, projection: ProjectionLike): ImageBase;


	/**
	 * Handle image change events.
	 * @param {module:ol/events/Event} event Event.
	 * @protected
	 */
	protected handleImageChange(event: Event) {
		const image = /** @type {module:ol/Image} */ (event.target);
		switch (image.getState()) {
			case ImageState.LOADING:
				this.dispatchEvent(
					new ImageSourceEvent(ImageSourceEventType.IMAGELOADSTART,
						image));
				break;
			case ImageState.LOADED:
				this.dispatchEvent(
					new ImageSourceEvent(ImageSourceEventType.IMAGELOADEND,
						image));
				break;
			case ImageState.ERROR:
				this.dispatchEvent(
					new ImageSourceEvent(ImageSourceEventType.IMAGELOADERROR,
						image));
				break;
			default:
			// pass
		}
	}


	/**
	 * @protected
	 * @param {number} resolution Resolution.
	 * @return {number} Resolution.
	 */
	protected findNearestResolution(resolution: number) {
		if (this.resolutions_) {
			const idx = linearFindNearest(this.resolutions_, resolution, 0);
			resolution = this.resolutions_[idx];
		}
		return resolution;
	}
}
/**
 * Default image load function for image sources that use module:ol/Image~Image image
 * instances.
 * @param {module:ol/Image} image Image.
 * @param {string} src Source.
 */
export function defaultImageLoadFunction(image: Image, src: string) {
	(image.getImage() as HTMLImageElement).src = src;
}
