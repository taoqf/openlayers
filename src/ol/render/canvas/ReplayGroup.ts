/**
 * @module ol/render/canvas/ReplayGroup
 */
import { numberSafeCompareFunction } from '../../array';
import { Coordinate } from '../../coordinate';
import { createCanvasContext2D } from '../../dom';
import { buffer, createEmpty, extendCoordinate, Extent } from '../../extent';
import Feature from '../../Feature';
import { transform2D } from '../../geom/flat/transform';
import { RenderType } from '../../layer/Vector';
import { isEmpty } from '../../obj';
import { compose as composeTransform, create as createTransform, Transform } from '../../transform';
import { DeclutterGroup } from '../canvas';
import CanvasImageReplay from '../canvas/ImageReplay';
import CanvasLineStringReplay from '../canvas/LineStringReplay';
import CanvasPolygonReplay from '../canvas/PolygonReplay';
import CanvasReplay from '../canvas/Replay';
import CanvasTextReplay from '../canvas/TextReplay';
import RenderFeature from '../Feature';
import { ORDER } from '../replay';
import ReplayGroup from '../ReplayGroup';
import ReplayType from '../ReplayType';


/**
 * @type {Object.<module:ol/render/ReplayType,
 *                function(new: module:ol/render/canvas/Replay, number, module:ol/extent~Extent,
 *                number, number, boolean, Array.<module:ol/render/canvas~DeclutterGroup>)>}
 */
const BATCH_CONSTRUCTORS = {
	Circle: CanvasPolygonReplay,
	Default: CanvasReplay,
	Image: CanvasImageReplay,
	LineString: CanvasLineStringReplay,
	Polygon: CanvasPolygonReplay,
	Text: CanvasTextReplay
};


/**
 * @constructor
 * @extends {module:ol/render/ReplayGroup}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {boolean} overlaps The replay group can have overlapping geometries.
 * @param {?} declutterTree Declutter tree
 * for declutter processing in postrender.
 * @param {number=} opt_renderBuffer Optional rendering buffer.
 * @struct
 */
export default class CanvasReplayGroup extends ReplayGroup {
	private declutterTree_: rbush.RBush<{
		maxX: number;
		maxY: number;
		minX: number;
		minY: number;
		value: Feature | RenderFeature;
	}>;
	private declutterGroup_: DeclutterGroup | null;
	private tolerance_: number;
	private maxExtent_: Extent;
	private overlaps_: boolean;
	private pixelRatio_: number;
	private resolution_: number;
	private renderBuffer_: number | undefined;
	// <string, !Object.<module:ol/render/ReplayType, module:ol/render/canvas/Replay>>
	private replaysByZIndex_: { [s: string]: { [t: string /*RenderType*/]: CanvasReplay; } };
	private hitDetectionContext_: CanvasRenderingContext2D;
	private hitDetectionTransform_: number[];
	constructor(tolerance: number, maxExtent: Extent, resolution: number, pixelRatio: number, overlaps: boolean, declutterTree: rbush.RBush<{ maxX: number; maxY: number; minX: number; minY: number; value: Feature | RenderFeature; }>, opt_renderBuffer?: number) {
		super();

		/**
		 * Declutter tree.
		 * @private
		 */
		this.declutterTree_ = declutterTree;

		/**
		 * @type {module:ol/render/canvas~DeclutterGroup}
		 * @private
		 */
		this.declutterGroup_ = null;

		/**
		 * @private
		 * @type {number}
		 */
		this.tolerance_ = tolerance;

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.maxExtent_ = maxExtent;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.overlaps_ = overlaps;

		/**
		 * @private
		 * @type {number}
		 */
		this.pixelRatio_ = pixelRatio;

		/**
		 * @private
		 * @type {number}
		 */
		this.resolution_ = resolution;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.renderBuffer_ = opt_renderBuffer;

		/**
		 * @private
		 * @type {!Object.<string, !Object.<module:ol/render/ReplayType, module:ol/render/canvas/Replay>>}
		 */
		this.replaysByZIndex_ = {};

		/**
		 * @private
		 * @type {CanvasRenderingContext2D}
		 */
		this.hitDetectionContext_ = createCanvasContext2D(1, 1);

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.hitDetectionTransform_ = createTransform();
	}

	/**
	 * @param {boolean} group Group with previous replay.
	 * @return {module:ol/render/canvas~DeclutterGroup} Declutter instruction group.
	 */
	public addDeclutter(group: boolean) {
		let declutter: Extent | null = null;
		if (this.declutterTree_) {
			if (group) {
				declutter = this.declutterGroup_ as Extent;
				/** @type {number} */
				(declutter![4])++;
			} else {
				declutter = this.declutterGroup_ = createEmpty();
				declutter.push(1);
			}
		}
		return declutter;
	}


	/**
	 * @param {CanvasRenderingContext2D} context Context.
	 * @param {module:ol/transform~Transform} transform Transform.
	 */
	public clip(context: CanvasRenderingContext2D, transform: Transform) {
		const flatClipCoords = this.getClipCoords(transform);
		context.beginPath();
		context.moveTo(flatClipCoords[0], flatClipCoords[1]);
		context.lineTo(flatClipCoords[2], flatClipCoords[3]);
		context.lineTo(flatClipCoords[4], flatClipCoords[5]);
		context.lineTo(flatClipCoords[6], flatClipCoords[7]);
		context.clip();
	}


	/**
	 * @param {Array.<module:ol/render/ReplayType>} replays Replays.
	 * @return {boolean} Has replays of the provided types.
	 */
	public hasReplays(replays: ReplayType[]) {
		return Object.keys(this.replaysByZIndex_).some((zIndex) => {
			const candidates = this.replaysByZIndex_[zIndex];
			for (let i = 0, ii = replays.length; i < ii; ++i) {
				if (replays[i] in candidates) {
					return true;
				}
			}
			return false;
		});
	}


	/**
	 * FIXME empty description for jsdoc
	 */
	public finish() {
		Object.keys(this.replaysByZIndex_).forEach((zKey) => {
			const replays = this.replaysByZIndex_[zKey];
			Object.keys(replays).forEach((replayKey) => {
				replays[replayKey].finish();
			});
		});
	}


	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {number} resolution Resolution.
	 * @param {number} rotation Rotation.
	 * @param {number} hitTolerance Hit tolerance in pixels.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T} callback Feature callback.
	 * @param {Object.<string, module:ol/render/canvas~DeclutterGroup>} declutterReplays Declutter replays.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	public forEachFeatureAtCoordinate<T>(coordinate: Coordinate, resolution: number, rotation: number, hitTolerance: number, skippedFeaturesHash: { [id: string]: boolean; }, callback: (feature: Feature | RenderFeature) => T, declutterReplays: { [id: string]: DeclutterGroup }): T | undefined {

		hitTolerance = Math.round(hitTolerance);
		const contextSize = hitTolerance * 2 + 1;
		const transform = composeTransform(this.hitDetectionTransform_,
			hitTolerance + 0.5, hitTolerance + 0.5,
			1 / resolution, -1 / resolution,
			-rotation,
			-coordinate[0], -coordinate[1]);
		const context = this.hitDetectionContext_;

		if (context.canvas.width !== contextSize || context.canvas.height !== contextSize) {
			context.canvas.width = contextSize;
			context.canvas.height = contextSize;
		} else {
			context.clearRect(0, 0, contextSize, contextSize);
		}

		/**
		 * @type {module:ol/extent~Extent}
		 */
		let hitExtent;
		if (this.renderBuffer_ !== undefined) {
			hitExtent = createEmpty();
			extendCoordinate(hitExtent, coordinate);
			buffer(hitExtent, resolution * (this.renderBuffer_ + hitTolerance), hitExtent);
		}

		const mask = getCircleArray(hitTolerance);
		const declutteredFeatures = (() => {
			if (this.declutterTree_) {
				return this.declutterTree_.all().map((entry) => {
					return entry.value;
				});
			} else {
				return null;
			}
		})();

		/** @type {Array.<number>} */
		const zs = Object.keys(this.replaysByZIndex_).map(Number);
		zs.sort(numberSafeCompareFunction);

		for (let i = zs.length - 1; i >= 0; --i) {
			const zIndexKey = zs[i].toString();
			const replays = this.replaysByZIndex_[zIndexKey];
			for (let j = ORDER.length - 1; j >= 0; --j) {
				const replayType = ORDER[j];
				const replay = replays[replayType];
				if (replay !== undefined) {
					if (declutterReplays &&
						(replayType === ReplayType.IMAGE || replayType === ReplayType.TEXT)) {
						const declutter = declutterReplays[zIndexKey];
						if (!declutter) {
							declutterReplays[zIndexKey] = [replay, transform.slice(0)];
						} else {
							declutter.push(replay, transform.slice(0));
						}
					} else {
						const result = replay.replayHitDetection(context, transform, rotation,
							skippedFeaturesHash, (f) => {
								const imageData = context.getImageData(0, 0, contextSize, contextSize).data;
								for (let ii = 0; ii < contextSize; ii++) {
									for (let jj = 0; jj < contextSize; jj++) {
										if (mask[ii][jj]) {
											if (imageData[(jj * contextSize + ii) * 4 + 3] > 0) {
												let r;
												if (!(declutteredFeatures && (replayType === ReplayType.IMAGE || replayType === ReplayType.TEXT)) ||
													declutteredFeatures.indexOf(f) !== -1) {
													r = callback(f);
												}
												if (r) {
													return r;
												} else {
													context.clearRect(0, 0, contextSize, contextSize);
													return undefined;
												}
											}
										}
									}
								}
								return undefined;
							}, hitExtent);
						if (result) {
							return result;
						}
					}
				}
			}
		}
		return undefined;
	}


	/**
	 * @param {module:ol/transform~Transform} transform Transform.
	 * @return {Array.<number>} Clip coordinates.
	 */
	public getClipCoords(transform: Transform) {
		const maxExtent = this.maxExtent_;
		const minX = maxExtent[0];
		const minY = maxExtent[1];
		const maxX = maxExtent[2];
		const maxY = maxExtent[3];
		const flatClipCoords = [minX, minY, minX, maxY, maxX, maxY, maxX, minY];
		transform2D(
			flatClipCoords, 0, 8, 2, transform, flatClipCoords);
		return flatClipCoords;
	}


	/**
	 * @inheritDoc
	 */
	public getReplay(zIndex: number | undefined, replayType: ReplayType) {
		const zIndexKey = zIndex !== undefined ? zIndex.toString() : '0';
		let replays = this.replaysByZIndex_[zIndexKey];
		if (replays === undefined) {
			replays = {};
			this.replaysByZIndex_[zIndexKey] = replays;
		}
		let replay = replays[replayType];
		if (replay === undefined) {
			const ctor = BATCH_CONSTRUCTORS[replayType];
			replay = new ctor(this.tolerance_, this.maxExtent_,
				this.resolution_, this.pixelRatio_, this.overlaps_, this.declutterTree_);
			replays[replayType] = replay;
		}
		return replay;
	}


	/**
	 * @return {Object.<string, Object.<module:ol/render/ReplayType, module:ol/render/canvas/Replay>>} Replays.
	 */
	public getReplays() {
		return this.replaysByZIndex_;
	}


	/**
	 * @inheritDoc
	 */
	public isEmpty() {
		return isEmpty(this.replaysByZIndex_);
	}


	/**
	 * @param {CanvasRenderingContext2D} context Context.
	 * @param {module:ol/transform~Transform} transform Transform.
	 * @param {number} viewRotation View rotation.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {Array.<module:ol/render/ReplayType>=} opt_replayTypes Ordered replay types to replay.
	 *     Default is {@link module:ol/render/replay~ORDER}
	 * @param {Object.<string, module:ol/render/canvas~DeclutterGroup>=} opt_declutterReplays Declutter replays.
	 */
	public replay(context: CanvasRenderingContext2D, transform: Transform, viewRotation: number, skippedFeaturesHash: { [id: string]: boolean; }, opt_replayTypes?: RenderType[], opt_declutterReplays?: DeclutterGroup) {

		/** @type {Array.<number>} */
		const zs = Object.keys(this.replaysByZIndex_).map(Number);
		zs.sort(numberSafeCompareFunction);

		// setup clipping so that the parts of over-simplified geometries are not
		// visible outside the current extent when panning
		context.save();
		this.clip(context, transform);

		const replayTypes = opt_replayTypes ? opt_replayTypes : ORDER;
		// let i, ii, j, jj, replays, replay;
		for (let i = 0, ii = zs.length; i < ii; ++i) {
			const zIndexKey = zs[i].toString();
			const replays = this.replaysByZIndex_[zIndexKey];
			for (let j = 0, jj = replayTypes.length; j < jj; ++j) {
				const replayType = replayTypes[j];
				const replay = replays[replayType];
				if (replay !== undefined) {
					if (opt_declutterReplays &&
						(replayType === ReplayType.IMAGE || replayType === ReplayType.TEXT)) {
						const declutter = opt_declutterReplays[+zIndexKey];
						if (!declutter) {
							opt_declutterReplays[+zIndexKey] = [replay, transform.slice(0)];
						} else {
							declutter.push(replay, transform.slice(0));
						}
					} else {
						replay.replay(context, transform, viewRotation, skippedFeaturesHash);
					}
				}
			}
		}

		context.restore();
	}
}

/**
 * This cache is used for storing calculated pixel circles for increasing performance.
 * It is a static property to allow each Replaygroup to access it.
 * @type {Object.<number, Array.<Array.<(boolean|undefined)>>>}
 */
const circleArrayCache = {
	0: [[true]]
} as { [idx: number]: Array<Array<boolean | undefined>> };


/**
 * This method fills a row in the array from the given coordinate to the
 * middle with `true`.
 * @param {Array.<Array.<(boolean|undefined)>>} array The array that will be altered.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 */
function fillCircleArrayRowToMiddle(array: Array<Array<boolean | undefined>>, x: number, y: number) {
	let i;
	const radius = Math.floor(array.length / 2);
	if (x >= radius) {
		for (i = radius; i < x; i++) {
			array[i][y] = true;
		}
	} else if (x < radius) {
		for (i = x + 1; i < radius; i++) {
			array[i][y] = true;
		}
	}
}


/**
 * This methods creates a circle inside a fitting array. Points inside the
 * circle are marked by true, points on the outside are undefined.
 * It uses the midpoint circle algorithm.
 * A cache is used to increase performance.
 * @param {number} radius Radius.
 * @returns {Array.<Array.<(boolean|undefined)>>} An array with marked circle points.
 */
export function getCircleArray(radius: number) {
	if (circleArrayCache[radius] !== undefined) {
		return circleArrayCache[radius];
	}

	const arraySize = radius * 2 + 1;
	const arr = new Array(arraySize);
	for (let i = 0; i < arraySize; i++) {
		arr[i] = new Array(arraySize);
	}

	let x = radius;
	let y = 0;
	let error = 0;

	while (x >= y) {
		fillCircleArrayRowToMiddle(arr, radius + x, radius + y);
		fillCircleArrayRowToMiddle(arr, radius + y, radius + x);
		fillCircleArrayRowToMiddle(arr, radius - y, radius + x);
		fillCircleArrayRowToMiddle(arr, radius - x, radius + y);
		fillCircleArrayRowToMiddle(arr, radius - x, radius - y);
		fillCircleArrayRowToMiddle(arr, radius - y, radius - x);
		fillCircleArrayRowToMiddle(arr, radius + y, radius - x);
		fillCircleArrayRowToMiddle(arr, radius + x, radius - y);

		y++;
		error += 1 + 2 * y;
		if (2 * (error - x) + 1 > 0) {
			x -= 1;
			error += 1 - 2 * x;
		}
	}

	circleArrayCache[radius] = arr;
	return arr;
}


/**
 * @param {!Object.<string, Array.<*>>} declutterReplays Declutter replays.
 * @param {CanvasRenderingContext2D} context Context.
 * @param {number} rotation Rotation.
 */
export function replayDeclutter(declutterReplays: { [s: string]: any[]; }, context: CanvasRenderingContext2D, rotation: number) {
	const zs = Object.keys(declutterReplays).map(Number).sort(numberSafeCompareFunction);
	const skippedFeatureUids = {};
	for (let z = 0, zz = zs.length; z < zz; ++z) {
		const replayData = declutterReplays[zs[z].toString()];
		for (let i = 0, ii = replayData.length; i < ii;) {
			const replay = replayData[i++];
			const transform = replayData[i++];
			replay.replay(context, transform, rotation, skippedFeatureUids);
		}
	}
}
