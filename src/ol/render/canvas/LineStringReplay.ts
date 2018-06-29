/**
 * @module ol/render/canvas/LineStringReplay
 */
import { Extent } from '../../extent';
import Feature from '../../Feature';
import LineString from '../../geom/LineString';
import MultiLineString from '../../geom/MultiLineString';
import { FillStrokeState } from '../canvas';
import CanvasInstruction, { beginPathInstruction, strokeInstruction } from '../canvas/Instruction';
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
export default class CanvasLineStringReplay extends CanvasReplay {
	constructor(tolerance: number, maxExtent: Extent, resolution: number, pixelRatio: number, overlaps: boolean, declutterTree: rbush.RBush<{
		maxX: number;
		maxY: number;
		minX: number;
		minY: number;
		value: Feature | RenderFeature;
	}>) {
		super(tolerance, maxExtent, resolution, pixelRatio, overlaps, declutterTree);
	}

	/**
	 * @inheritDoc
	 */
	public drawLineString(lineStringGeometry: LineString | RenderFeature, feature: Feature | RenderFeature) {
		const state = this.state;
		const strokeStyle = state.strokeStyle;
		const lineWidth = state.lineWidth;
		if (strokeStyle === undefined || lineWidth === undefined) {
			return;
		}
		this.updateStrokeStyle(state, this.applyStroke);
		this.beginGeometry(lineStringGeometry, feature);
		this.hitDetectionInstructions.push([
			CanvasInstruction.SET_STROKE_STYLE,
			state.strokeStyle, state.lineWidth, state.lineCap, state.lineJoin,
			state.miterLimit, state.lineDash, state.lineDashOffset
		], beginPathInstruction);
		const flatCoordinates = lineStringGeometry.getFlatCoordinates();
		const stride = lineStringGeometry.getStride();
		this.drawFlatCoordinates_(flatCoordinates, 0, flatCoordinates.length, stride);
		this.hitDetectionInstructions.push(strokeInstruction);
		this.endGeometry(lineStringGeometry, feature);
	}


	/**
	 * @inheritDoc
	 */
	public drawMultiLineString(multiLineStringGeometry: MultiLineString | RenderFeature, feature: Feature | RenderFeature) {
		const state = this.state;
		const strokeStyle = state.strokeStyle;
		const lineWidth = state.lineWidth;
		if (strokeStyle === undefined || lineWidth === undefined) {
			return;
		}
		this.updateStrokeStyle(state, this.applyStroke);
		this.beginGeometry(multiLineStringGeometry, feature);
		this.hitDetectionInstructions.push([
			CanvasInstruction.SET_STROKE_STYLE,
			state.strokeStyle, state.lineWidth, state.lineCap, state.lineJoin,
			state.miterLimit, state.lineDash, state.lineDashOffset
		], beginPathInstruction);
		const ends = multiLineStringGeometry.getEnds() as number[];
		const flatCoordinates = multiLineStringGeometry.getFlatCoordinates();
		const stride = multiLineStringGeometry.getStride();
		let offset = 0;
		for (let i = 0, ii = ends.length; i < ii; ++i) {
			offset = this.drawFlatCoordinates_(flatCoordinates, offset, ends[i], stride);
		}
		this.hitDetectionInstructions.push(strokeInstruction);
		this.endGeometry(multiLineStringGeometry, feature);
	}


	/**
	 * @inheritDoc
	 */
	public finish() {
		const state = this.state;
		if (state.lastStroke !== undefined && state.lastStroke !== this.coordinates.length) {
			this.instructions.push(strokeInstruction);
		}
		this.reverseHitDetectionInstructions();
		this.state = null!;
	}


	/**
	 * @inheritDoc.
	 */
	public applyStroke(state: FillStrokeState) {
		if (state.lastStroke !== undefined && state.lastStroke !== this.coordinates.length) {
			this.instructions.push(strokeInstruction);
			state.lastStroke = this.coordinates.length;
		}
		state.lastStroke = 0;
		CanvasReplay.prototype.applyStroke.call(this, state);
		this.instructions.push(beginPathInstruction);
	}

	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 * @private
	 * @return {number} end.
	 */
	private drawFlatCoordinates_(flatCoordinates: number[], offset: number, end: number, stride: number) {
		const myBegin = this.coordinates.length;
		const myEnd = this.appendFlatCoordinates(
			flatCoordinates, offset, end, stride, false, false);
		const moveToLineToInstruction = [CanvasInstruction.MOVE_TO_LINE_TO, myBegin, myEnd];
		this.instructions.push(moveToLineToInstruction);
		this.hitDetectionInstructions.push(moveToLineToInstruction);
		return end;
	}
}
