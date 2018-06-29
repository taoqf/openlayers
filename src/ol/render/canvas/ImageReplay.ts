/**
 * @module ol/render/canvas/ImageReplay
 */
import { Extent } from '../../extent';
import Feature from '../../Feature';
import MultiPoint from '../../geom/MultiPoint';
import Point from '../../geom/Point';
import Image from '../../style/Image';
import { DeclutterGroup } from '../canvas';
import CanvasInstruction from '../canvas/Instruction';
import CanvasReplay from '../canvas/Replay';
import RenderFeature from '../Feature';

/**
 * @constructor
 * @extends {module:ol/render/canvas/Replay}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Maximum extent.
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {boolean} overlaps The replay can have overlapping geometries.
 * @param {?} declutterTree Declutter tree.
 * @struct
 */
export default class CanvasImageReplay extends CanvasReplay {
	private declutterGroup_: DeclutterGroup | null;
	private hitDetectionImage_: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;
	private image_: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;
	private anchorX_: number | undefined;
	private anchorY_: number | undefined;
	private height_: number | undefined;
	private opacity_: number | undefined;
	private originX_: number | undefined;
	private originY_: number | undefined;
	private rotateWithView_: boolean | undefined;
	private rotation_: number | undefined;
	private scale_: number | undefined;
	private snapToPixel_: boolean | undefined;
	private width_: number | undefined;
	constructor(tolerance: number, maxExtent: Extent, resolution: number, pixelRatio: number, overlaps: boolean, declutterTree: rbush.RBush<{
		maxX: number;
		maxY: number;
		minX: number;
		minY: number;
		value: Feature | RenderFeature;
	}>) {
		super(tolerance, maxExtent, resolution, pixelRatio, overlaps, declutterTree);

		/**
		 * @private
		 * @type {module:ol/render/canvas~DeclutterGroup}
		 */
		this.declutterGroup_ = null;

		/**
		 * @private
		 * @type {HTMLCanvasElement|HTMLVideoElement|Image}
		 */
		this.hitDetectionImage_ = null;

		/**
		 * @private
		 * @type {HTMLCanvasElement|HTMLVideoElement|Image}
		 */
		this.image_ = null;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.anchorX_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.anchorY_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.height_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.opacity_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.originX_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.originY_ = undefined;

		/**
		 * @private
		 * @type {boolean|undefined}
		 */
		this.rotateWithView_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.rotation_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.scale_ = undefined;

		/**
		 * @private
		 * @type {boolean|undefined}
		 */
		this.snapToPixel_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.width_ = undefined;

	}
	/**
	 * @inheritDoc
	 */
	public drawPoint(pointGeometry: Point | RenderFeature, feature: Feature | RenderFeature) {
		if (!this.image_) {
			return;
		}
		this.beginGeometry(pointGeometry, feature);
		const flatCoordinates = pointGeometry.getFlatCoordinates();
		const stride = pointGeometry.getStride();
		const myBegin = this.coordinates.length;
		const myEnd = this.drawCoordinates_(flatCoordinates, 0, flatCoordinates.length, stride);
		this.instructions.push([
			CanvasInstruction.DRAW_IMAGE, myBegin, myEnd, this.image_,
			// Remaining arguments to DRAW_IMAGE are in alphabetical order
			this.anchorX_, this.anchorY_, this.declutterGroup_, this.height_, this.opacity_,
			this.originX_, this.originY_, this.rotateWithView_, this.rotation_,
			this.scale_! * this.pixelRatio, this.snapToPixel_, this.width_
		]);
		this.hitDetectionInstructions.push([
			CanvasInstruction.DRAW_IMAGE, myBegin, myEnd, this.hitDetectionImage_,
			// Remaining arguments to DRAW_IMAGE are in alphabetical order
			this.anchorX_, this.anchorY_, this.declutterGroup_, this.height_, this.opacity_,
			this.originX_, this.originY_, this.rotateWithView_, this.rotation_,
			this.scale_, this.snapToPixel_, this.width_
		]);
		this.endGeometry(pointGeometry, feature);
	}


	/**
	 * @inheritDoc
	 */
	public drawMultiPoint(multiPointGeometry: MultiPoint | RenderFeature, feature: Feature | RenderFeature) {
		if (!this.image_) {
			return;
		}
		this.beginGeometry(multiPointGeometry, feature);
		const flatCoordinates = multiPointGeometry.getFlatCoordinates();
		const stride = multiPointGeometry.getStride();
		const myBegin = this.coordinates.length;
		const myEnd = this.drawCoordinates_(
			flatCoordinates, 0, flatCoordinates.length, stride);
		this.instructions.push([
			CanvasInstruction.DRAW_IMAGE, myBegin, myEnd, this.image_,
			// Remaining arguments to DRAW_IMAGE are in alphabetical order
			this.anchorX_, this.anchorY_, this.declutterGroup_, this.height_, this.opacity_,
			this.originX_, this.originY_, this.rotateWithView_, this.rotation_,
			this.scale_! * this.pixelRatio, this.snapToPixel_, this.width_
		]);
		this.hitDetectionInstructions.push([
			CanvasInstruction.DRAW_IMAGE, myBegin, myEnd, this.hitDetectionImage_,
			// Remaining arguments to DRAW_IMAGE are in alphabetical order
			this.anchorX_, this.anchorY_, this.declutterGroup_, this.height_, this.opacity_,
			this.originX_, this.originY_, this.rotateWithView_, this.rotation_,
			this.scale_, this.snapToPixel_, this.width_
		]);
		this.endGeometry(multiPointGeometry, feature);
	}


	/**
	 * @inheritDoc
	 */
	public finish() {
		this.reverseHitDetectionInstructions();
		// FIXME this doesn't really protect us against further calls to draw*Geometry
		this.anchorX_ = undefined;
		this.anchorY_ = undefined;
		this.hitDetectionImage_ = null;
		this.image_ = null;
		this.height_ = undefined;
		this.scale_ = undefined;
		this.opacity_ = undefined;
		this.originX_ = undefined;
		this.originY_ = undefined;
		this.rotateWithView_ = undefined;
		this.rotation_ = undefined;
		this.snapToPixel_ = undefined;
		this.width_ = undefined;
	}


	/**
	 * @inheritDoc
	 */
	public setImageStyle(imageStyle: Image, declutterGroup: DeclutterGroup) {
		const anchor = imageStyle.getAnchor()!;
		const size = imageStyle.getSize()!;
		const hitDetectionImage = imageStyle.getHitDetectionImage(1);
		const image = imageStyle.getImage(1);
		const origin = imageStyle.getOrigin()!;
		this.anchorX_ = anchor[0];
		this.anchorY_ = anchor[1];
		this.declutterGroup_ = /** @type {module:ol/render/canvas~DeclutterGroup} */ (declutterGroup);
		this.hitDetectionImage_ = hitDetectionImage;
		this.image_ = image;
		this.height_ = size[1];
		this.opacity_ = imageStyle.getOpacity();
		this.originX_ = origin[0];
		this.originY_ = origin[1];
		this.rotateWithView_ = imageStyle.getRotateWithView();
		this.rotation_ = imageStyle.getRotation();
		this.scale_ = imageStyle.getScale();
		this.snapToPixel_ = imageStyle.getSnapToPixel();
		this.width_ = size[0];
	}

	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 * @private
	 * @return {number} My end.
	 */
	private drawCoordinates_(flatCoordinates: number[], offset: number, end: number, stride: number) {
		return this.appendFlatCoordinates(flatCoordinates, offset, end, stride, false, false);
	}
}
