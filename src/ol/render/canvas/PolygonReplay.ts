/**
 * @module ol/render/canvas/PolygonReplay
 */
import { asString } from '../../color';
import { Extent } from '../../extent';
import Feature from '../../Feature';
import Circle from '../../geom/Circle';
import { snap } from '../../geom/flat/simplify';
import Geometry from '../../geom/Geometry';
import MultiPolygon from '../../geom/MultiPolygon';
import Polygon from '../../geom/Polygon';
import { defaultFillStyle } from '../canvas';
import CanvasInstruction, { beginPathInstruction, closePathInstruction, fillInstruction, strokeInstruction } from '../canvas/Instruction';
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
export default class CanvasPolygonReplay extends CanvasReplay {
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
	public drawCircle(circleGeometry: Circle | RenderFeature, feature: Feature | RenderFeature) {
		const state = this.state;
		const fillStyle = state.fillStyle;
		const strokeStyle = state.strokeStyle;
		if (fillStyle === undefined && strokeStyle === undefined) {
			return;
		}
		this.setFillStrokeStyles_(circleGeometry);
		this.beginGeometry(circleGeometry, feature);
		// always fill the circle for hit detection
		this.hitDetectionInstructions.push([
			CanvasInstruction.SET_FILL_STYLE,
			asString(defaultFillStyle)
		]);
		if (state.strokeStyle !== undefined) {
			this.hitDetectionInstructions.push([
				CanvasInstruction.SET_STROKE_STYLE,
				state.strokeStyle, state.lineWidth, state.lineCap, state.lineJoin,
				state.miterLimit, state.lineDash, state.lineDashOffset
			]);
		}
		const flatCoordinates = circleGeometry.getFlatCoordinates();
		const stride = circleGeometry.getStride();
		const myBegin = this.coordinates.length;
		this.appendFlatCoordinates(
			flatCoordinates, 0, flatCoordinates.length, stride, false, false);
		const circleInstruction = [CanvasInstruction.CIRCLE, myBegin];
		this.instructions.push(beginPathInstruction, circleInstruction);
		this.hitDetectionInstructions.push(beginPathInstruction, circleInstruction);
		this.hitDetectionInstructions.push(fillInstruction);
		if (state.fillStyle !== undefined) {
			this.instructions.push(fillInstruction);
		}
		if (state.strokeStyle !== undefined) {
			this.instructions.push(strokeInstruction);
			this.hitDetectionInstructions.push(strokeInstruction);
		}
		this.endGeometry(circleGeometry, feature);
	}

	/**
	 * @inheritDoc
	 */
	public drawPolygon(polygonGeometry: Polygon | RenderFeature, feature: Feature | RenderFeature) {
		const state = this.state;
		this.setFillStrokeStyles_(polygonGeometry);
		this.beginGeometry(polygonGeometry, feature);
		// always fill the polygon for hit detection
		this.hitDetectionInstructions.push([
			CanvasInstruction.SET_FILL_STYLE,
			asString(defaultFillStyle)]
		);
		if (state.strokeStyle !== undefined) {
			this.hitDetectionInstructions.push([
				CanvasInstruction.SET_STROKE_STYLE,
				state.strokeStyle, state.lineWidth, state.lineCap, state.lineJoin,
				state.miterLimit, state.lineDash, state.lineDashOffset
			]);
		}
		const ends = polygonGeometry.getEnds() as number[];
		const flatCoordinates = polygonGeometry.getOrientedFlatCoordinates();
		const stride = polygonGeometry.getStride();
		this.drawFlatCoordinatess_(flatCoordinates, 0, ends, stride);
		this.endGeometry(polygonGeometry, feature);
	}


	/**
	 * @inheritDoc
	 */
	public drawMultiPolygon(multiPolygonGeometry: MultiPolygon | RenderFeature, feature: Feature | RenderFeature) {
		const state = this.state;
		const fillStyle = state.fillStyle;
		const strokeStyle = state.strokeStyle;
		if (fillStyle === undefined && strokeStyle === undefined) {
			return;
		}
		this.setFillStrokeStyles_(multiPolygonGeometry);
		this.beginGeometry(multiPolygonGeometry, feature);
		// always fill the multi-polygon for hit detection
		this.hitDetectionInstructions.push([
			CanvasInstruction.SET_FILL_STYLE,
			asString(defaultFillStyle)
		]);
		if (state.strokeStyle !== undefined) {
			this.hitDetectionInstructions.push([
				CanvasInstruction.SET_STROKE_STYLE,
				state.strokeStyle, state.lineWidth, state.lineCap, state.lineJoin,
				state.miterLimit, state.lineDash, state.lineDashOffset
			]);
		}
		const endss = multiPolygonGeometry.getEndss() as number[][];
		const flatCoordinates = multiPolygonGeometry.getOrientedFlatCoordinates();
		const stride = multiPolygonGeometry.getStride();
		let offset = 0;
		for (let i = 0, ii = endss.length; i < ii; ++i) {
			offset = this.drawFlatCoordinatess_(flatCoordinates, offset, endss[i], stride);
		}
		this.endGeometry(multiPolygonGeometry, feature);
	}


	/**
	 * @inheritDoc
	 */
	public finish() {
		this.reverseHitDetectionInstructions();
		this.state = null!;
		// We want to preserve topology when drawing polygons.  Polygons are
		// simplified using quantization and point elimination. However, we might
		// have received a mix of quantized and non-quantized geometries, so ensure
		// that all are quantized by quantizing all coordinates in the batch.
		const tolerance = this.tolerance;
		if (tolerance !== 0) {
			const coordinates = this.coordinates;
			for (let i = 0, ii = coordinates.length; i < ii; ++i) {
				coordinates[i] = snap(coordinates[i], tolerance);
			}
		}
	}


	/**
	 * @private
	 * @param {module:ol/geom/Geometry|module:ol/render/Feature} geometry Geometry.
	 */
	private setFillStrokeStyles_(geometry: Geometry | RenderFeature) {
		const state = this.state;
		const fillStyle = state.fillStyle;
		if (fillStyle !== undefined) {
			this.updateFillStyle(state, this.createFill, geometry);
		}
		if (state.strokeStyle !== undefined) {
			this.updateStrokeStyle(state, this.applyStroke);
		}
	}

	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {Array.<number>} ends Ends.
	 * @param {number} stride Stride.
	 * @private
	 * @return {number} End.
	 */
	private drawFlatCoordinatess_(flatCoordinates: number[], offset: number, ends: number[], stride: number) {
		const state = this.state;
		const fill = state.fillStyle !== undefined;
		const stroke = state.strokeStyle !== undefined;
		const numEnds = ends.length;
		this.instructions.push(beginPathInstruction);
		this.hitDetectionInstructions.push(beginPathInstruction);
		for (let i = 0; i < numEnds; ++i) {
			const end = ends[i];
			const myBegin = this.coordinates.length;
			const myEnd = this.appendFlatCoordinates(flatCoordinates, offset, end, stride, true, !stroke);
			const moveToLineToInstruction = [CanvasInstruction.MOVE_TO_LINE_TO, myBegin, myEnd];
			this.instructions.push(moveToLineToInstruction);
			this.hitDetectionInstructions.push(moveToLineToInstruction);
			if (stroke) {
				// Performance optimization: only call closePath() when we have a stroke.
				// Otherwise the ring is closed already (see appendFlatCoordinates above).
				this.instructions.push(closePathInstruction);
				this.hitDetectionInstructions.push(closePathInstruction);
			}
			offset = end;
		}
		this.hitDetectionInstructions.push(fillInstruction);
		if (fill) {
			this.instructions.push(fillInstruction);
		}
		if (stroke) {
			this.instructions.push(strokeInstruction);
			this.hitDetectionInstructions.push(strokeInstruction);
		}
		return offset;
	}
}
