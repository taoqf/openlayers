/**
 * @module ol/render/webgl/ReplayGroup
 */
import { numberSafeCompareFunction } from '../../array';
import { Coordinate } from '../../coordinate';
import { buffer, createOrUpdateFromCoordinate, Extent } from '../../extent';
import Feature from '../../Feature';
import { isEmpty } from '../../obj';
import { Size } from '../../size';
import Style from '../../style/Style';
import WebGLContext from '../../webgl/Context';
import RenderFeature from '../Feature';
import { ORDER } from '../replay';
import ReplayGroup from '../ReplayGroup';
import ReplayType from '../ReplayType';
import WebGLCircleReplay from '../webgl/CircleReplay';
import WebGLImageReplay from '../webgl/ImageReplay';
import WebGLLineStringReplay from '../webgl/LineStringReplay';
import WebGLPolygonReplay from '../webgl/PolygonReplay';
import WebGLTextReplay from '../webgl/TextReplay';
import WebGLReplay from './Replay';

/**
 * @type {Array.<number>}
 */
const HIT_DETECTION_SIZE = [1, 1];

/**
 * @type {Object.<module:ol/render/ReplayType,
 *                function(new: module:ol/render/webgl/Replay, number,
 *                module:ol/extent~Extent)>}
 */
const BATCH_CONSTRUCTORS = {
	Circle: WebGLCircleReplay,
	Image: WebGLImageReplay,
	LineString: WebGLLineStringReplay,
	Polygon: WebGLPolygonReplay,
	Text: WebGLTextReplay
} as { [key: string]: typeof WebGLReplay; };


/**
 * @constructor
 * @extends {module:ol/render/ReplayGroup}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @param {number=} opt_renderBuffer Render buffer.
 * @struct
 */
export default class WebGLReplayGroup extends ReplayGroup {
	private maxExtent_: Extent;
	private tolerance_: number;
	private renderBuffer_: number;
	private replaysByZIndex_: {
		[key: string]: {
			[type: string]: WebGLReplay;
			// [type: ReplayType]: WebGLReplay
		};
	};
	constructor(tolerance: number, maxExtent: Extent, opt_renderBuffer?: number) {
		super();

		/**
		 * @type {module:ol/extent~Extent}
		 * @private
		 */
		this.maxExtent_ = maxExtent;

		/**
		 * @type {number}
		 * @private
		 */
		this.tolerance_ = tolerance;

		/**
		 * @type {number|undefined}
		 * @private
		 */
		this.renderBuffer_ = opt_renderBuffer;

		/**
		 * @private
		 * @type {!Object.<string,
		 *        Object.<module:ol/render/ReplayType, module:ol/render/webgl/Replay>>}
		 */
		this.replaysByZIndex_ = {};

	}

	/**
	 * @param {module:ol/style/Style} style Style.
	 * @param {boolean} group Group with previous replay.
	 */
	public addDeclutter(_style: Style, _group: boolean) { }

	/**
	 * @param {module:ol/webgl/Context} context WebGL context.
	 * @return {function()} Delete resources function.
	 */
	public getDeleteResourcesFunction(context: WebGLContext) {
		const functions = [] as Array<() => any>;
		Object.keys(this.replaysByZIndex_).forEach((zKey) => {
			const replays = this.replaysByZIndex_[zKey];
			for (const replayKey in replays) {
				functions.push(
					replays[replayKey].getDeleteResourcesFunction(context));
			}
		});
		return () => {
			const length = functions.length;
			let result;
			for (let i = 0; i < length; i++) {
				result = functions[i].apply(this, arguments);
			}
			return result;
		};
	}

	/**
	 * @param {module:ol/webgl/Context} context Context.
	 */
	public finish(context: WebGLContext) {
		let zKey;
		for (zKey in this.replaysByZIndex_) {
			const replays = this.replaysByZIndex_[zKey];
			for (const replayKey in replays) {
				replays[replayKey].finish(context);
			}
		}
	}

	public getReplay(zIndex: number | undefined, replayType: ReplayType) {
		const zIndexKey = zIndex !== undefined ? zIndex.toString() : '0';
		let replays = this.replaysByZIndex_[zIndexKey];
		if (replays === undefined) {
			replays = {};
			this.replaysByZIndex_[zIndexKey] = replays;
		}
		let replay = replays[replayType];
		if (replay === undefined) {
			/**
			 * @type {Function}
			 */
			const ctr = BATCH_CONSTRUCTORS[replayType] as any;
			replay = new ctr(this.tolerance_, this.maxExtent_);
			replays[replayType] = replay;
		}
		return replay;
	}

	public isEmpty() {
		return isEmpty(this.replaysByZIndex_);
	}

	/**
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {module:ol/coordinate~Coordinate} center Center.
	 * @param {number} resolution Resolution.
	 * @param {number} rotation Rotation.
	 * @param {module:ol/size~Size} size Size.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {number} opacity Global opacity.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 */
	public replay(context: WebGLContext, center: Coordinate, resolution: number, rotation: number, size: Size, pixelRatio: number, opacity: number, skippedFeaturesHash: { [featureid: string]: boolean; }) {
		/** @type {Array.<number>} */
		const zs = Object.keys(this.replaysByZIndex_).map(Number);
		zs.sort(numberSafeCompareFunction);

		// let i, ii, j, jj, replays, replay;
		for (let i = 0, ii = zs.length; i < ii; ++i) {
			const replays = this.replaysByZIndex_[zs[i].toString()];
			for (let j = 0, jj = ORDER.length; j < jj; ++j) {
				const replay = replays[ORDER[j]];
				if (replay !== undefined) {
					replay.replay(context,
						center, resolution, rotation, size, pixelRatio,
						opacity, skippedFeaturesHash,
						undefined, false);
				}
			}
		}
	}

	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {module:ol/coordinate~Coordinate} center Center.
	 * @param {number} resolution Resolution.
	 * @param {number} rotation Rotation.
	 * @param {module:ol/size~Size} size Size.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {number} opacity Global opacity.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T|undefined} callback Feature callback.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	public forEachFeatureAtCoordinate(coordinate: Coordinate, context: WebGLContext, _center: Coordinate, resolution: number, rotation: number, _size: Size, pixelRatio: number, opacity: number, skippedFeaturesHash: { [featureid: string]: boolean; }, callback: (feature: Feature | RenderFeature) => void) {
		const gl = context.getGL();
		gl.bindFramebuffer(
			gl.FRAMEBUFFER, context.getHitDetectionFramebuffer());


		/**
		 * @type {module:ol/extent~Extent}
		 */
		let hitExtent: Extent;
		if (this.renderBuffer_ !== undefined) {
			// build an extent around the coordinate, so that only features that
			// intersect this extent are checked
			hitExtent = buffer(createOrUpdateFromCoordinate(coordinate), resolution * this.renderBuffer_);
		}

		return this.replayHitDetection_(context,
			coordinate, resolution, rotation, HIT_DETECTION_SIZE as Size,
			pixelRatio, opacity, skippedFeaturesHash,
			/**
			 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
			 * @return {?} Callback result.
			 */
			(feature) => {
				const imageData = new Uint8Array(4);
				gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

				if (imageData[3] > 0) {
					const result = callback(feature);
					if (result) {
						return result;
					}
				}
			}, true, hitExtent);
	}

	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {module:ol/coordinate~Coordinate} center Center.
	 * @param {number} resolution Resolution.
	 * @param {number} rotation Rotation.
	 * @param {module:ol/size~Size} size Size.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {number} opacity Global opacity.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @return {boolean} Is there a feature at the given coordinate?
	 */
	public hasFeatureAtCoordinate(coordinate: [number, number], context: WebGLContext, _center: Coordinate, resolution: number, rotation: number, _size: Size, pixelRatio: number, opacity: number, skippedFeaturesHash: { [featureid: string]: boolean; }) {
		const gl = context.getGL();
		gl.bindFramebuffer(
			gl.FRAMEBUFFER, context.getHitDetectionFramebuffer());

		const hasFeature = this.replayHitDetection_(context,
			coordinate, resolution, rotation, HIT_DETECTION_SIZE as Size,
			pixelRatio, opacity, skippedFeaturesHash,
			/**
			 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
			 * @return {boolean} Is there a feature?
			 */
			(_feature: Feature | RenderFeature) => {
				const imageData = new Uint8Array(4);
				gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
				return imageData[3] > 0;
			}, false);

		return hasFeature !== undefined;
	}

	/**
	 * @private
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {module:ol/coordinate~Coordinate} center Center.
	 * @param {number} resolution Resolution.
	 * @param {number} rotation Rotation.
	 * @param {module:ol/size~Size} size Size.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {number} opacity Global opacity.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T|undefined} featureCallback Feature callback.
	 * @param {boolean} oneByOne Draw features one-by-one for the hit-detecion.
	 * @param {module:ol/extent~Extent=} opt_hitExtent Hit extent: Only features intersecting
	 *  this extent are checked.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	private replayHitDetection_<T>(context: WebGLContext, center: Coordinate, resolution: number, rotation: number, size: Size, pixelRatio: number, opacity: number, skippedFeaturesHash: { [featureid: string]: boolean; }, featureCallback: (feature: Feature | RenderFeature) => T, oneByOne: boolean, opt_hitExtent?: Extent) {
		/** @type {Array.<number>} */
		const zs = Object.keys(this.replaysByZIndex_).map(Number);
		zs.sort((a, b) => {
			return b - a;
		});

		for (let i = 0, ii = zs.length; i < ii; ++i) {
			const replays = this.replaysByZIndex_[zs[i].toString()];
			for (let j = ORDER.length - 1; j >= 0; --j) {
				const replay = replays[ORDER[j]];
				if (replay !== undefined) {
					const result = replay.replay(context,
						center, resolution, rotation, size, pixelRatio, opacity,
						skippedFeaturesHash, featureCallback, oneByOne, opt_hitExtent);
					if (result) {
						return result;
					}
				}
			}
		}
		return undefined;
	}
}
