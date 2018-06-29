/**
 * @module ol/render/canvas/TextReplay
 */
import { asColorLike } from '../../colorlike';
import { createCanvasContext2D } from '../../dom';
import { Extent, intersects } from '../../extent';
import Feature from '../../Feature';
import Circle from '../../geom/Circle';
import { matchingChunk } from '../../geom/flat/straightchunk';
import Geometry from '../../geom/Geometry';
import GeometryType from '../../geom/GeometryType';
import LineString from '../../geom/LineString';
import MultiLineString from '../../geom/MultiLineString';
import MultiPoint from '../../geom/MultiPoint';
import MultiPolygon from '../../geom/MultiPolygon';
import Polygon from '../../geom/Polygon';
import { CANVAS_LINE_DASH } from '../../has';
import { getUid } from '../../index';
import Text, { Options } from '../../style/Text';
import TextPlacement from '../../style/TextPlacement';
import { checkFont, DeclutterGroup, defaultFillStyle, defaultFont, defaultLineCap, defaultLineDash, defaultLineDashOffset, defaultLineJoin, defaultLineWidth, defaultMiterLimit, defaultPadding, defaultStrokeStyle, defaultTextAlign, defaultTextBaseline, FillState, labelCache, measureTextHeight, measureTextWidth, StrokeState, TextState } from '../canvas';
import CanvasInstruction from '../canvas/Instruction';
import CanvasReplay from '../canvas/Replay';
import RenderFeature from '../Feature';
import { TEXT_ALIGN } from '../replay';

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
export default abstract class CanvasTextReplay extends CanvasReplay {
	public fillStates: { [s: string]: FillState };
	public strokeStates: { [s: string]: StrokeState; };
	private textStrokeState_: StrokeState | null;
	private declutterGroup_: DeclutterGroup | undefined;
	/**
	 * @private
	 * @type {Array.<HTMLCanvasElement>}
	 */
	// private labels_: HTMLCanvasElement[] | null | undefined;
	private text_: string;
	private textOffsetX_: number;
	private textOffsetY_: number;
	private textRotateWithView_: boolean | undefined;
	private textRotation_: number;
	private textFillState_: FillState | null;
	private textState_: Options;
	private textKey_: string;
	private fillKey_: string;
	private strokeKey_: string;
	private widths_: { [s: string]: { [s: string]: number; }; };
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
		 * @type {string}
		 */
		this.text_ = '';

		/**
		 * @private
		 * @type {number}
		 */
		this.textOffsetX_ = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.textOffsetY_ = 0;

		/**
		 * @private
		 * @type {boolean|undefined}
		 */
		this.textRotateWithView_ = undefined;

		/**
		 * @private
		 * @type {number}
		 */
		this.textRotation_ = 0;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~FillState}
		 */
		this.textFillState_ = null;

		/**
		 * @type {!Object.<string, module:ol/render/canvas~FillState>}
		 */
		this.fillStates = {};

		/**
		 * @private
		 * @type {?module:ol/render/canvas~StrokeState}
		 */
		this.textStrokeState_ = null;

		/**
		 * @type {!Object.<string, module:ol/render/canvas~StrokeState>}
		 */
		this.strokeStates = {};

		/**
		 * @private
		 * @type {module:ol/render/canvas~TextState}
		 */
		this.textState_ = /** @type {module:ol/render/canvas~TextState} */ ({} as Options);	// todo TextState

		/**
		 * @type {!Object.<string, module:ol/render/canvas~TextState>}
		 */
		this.textStates = {};

		/**
		 * @private
		 * @type {string}
		 */
		this.textKey_ = '';

		/**
		 * @private
		 * @type {string}
		 */
		this.fillKey_ = '';

		/**
		 * @private
		 * @type {string}
		 */
		this.strokeKey_ = '';

		/**
		 * @private
		 * @type {Object.<string, Object.<string, number>>}
		 */
		this.widths_ = {};

		labelCache.prune();

	}

	/**
	 * @inheritDoc
	 */
	public drawText(geometry: Geometry | RenderFeature, feature: Feature | RenderFeature): void {
		const fillState = this.textFillState_;
		const strokeState = this.textStrokeState_;
		const textState = this.textState_;
		if (this.text_ === '' || !textState || (!fillState && !strokeState)) {
			return;
		}

		let begin = this.coordinates.length;

		const geometryType = geometry.getType();
		let flatCoordinates = null;
		let end = 2;
		let stride = 2;
		// let i, ii;

		if (textState.placement === TextPlacement.LINE) {
			if (!intersects(this.getBufferedMaxExtent(), geometry.getExtent())) {
				return;
			}
			let ends: number[] | undefined;
			flatCoordinates = (geometry as RenderFeature).getFlatCoordinates();
			stride = (geometry as RenderFeature).getStride();
			if (geometryType === GeometryType.LINE_STRING) {
				ends = [flatCoordinates.length];
			} else if (geometryType === GeometryType.MULTI_LINE_STRING) {
				ends = (geometry as RenderFeature).getEnds() as number[];
			} else if (geometryType === GeometryType.POLYGON) {
				ends = (geometry as RenderFeature).getEnds().slice(0, 1) as number[];
			} else if (geometryType === GeometryType.MULTI_POLYGON) {
				const endss = (geometry as RenderFeature).getEndss() as number[][];
				ends = [];
				for (let i = 0, ii = endss.length; i < ii; ++i) {
					(ends as number[]).push(endss[i][0]);
				}
			}
			this.beginGeometry(geometry, feature);
			const textAlign = textState.textAlign;
			let flatOffset = 0;
			let flatEnd;
			for (let o = 0, oo = ends!.length; o < oo; ++o) {
				if (textAlign === undefined) {
					const range = matchingChunk(textState.maxAngle, flatCoordinates, flatOffset, ends![o], stride);
					flatOffset = range[0];
					flatEnd = range[1];
				} else {
					flatEnd = ends![o];
				}
				for (let i = flatOffset; i < flatEnd; i += stride) {
					this.coordinates.push(flatCoordinates[i], flatCoordinates[i + 1]);
				}
				end = this.coordinates.length;
				flatOffset = ends![o];
				this.drawChars_(begin, end, this.declutterGroup_!);
				begin = end;
			}
			this.endGeometry(geometry, feature);

		} else {
			const label = this.getImage(this.text_, this.textKey_, this.fillKey_, this.strokeKey_);
			const width = label.width / this.pixelRatio;
			switch (geometryType) {
				case GeometryType.POINT:
				case GeometryType.MULTI_POINT:
					flatCoordinates = (geometry as MultiPoint).getFlatCoordinates();
					end = flatCoordinates.length;
					break;
				case GeometryType.LINE_STRING:
					flatCoordinates = /** @type {module:ol/geom/LineString} */ (geometry as LineString).getFlatMidpoint();
					break;
				case GeometryType.CIRCLE:
					flatCoordinates = /** @type {module:ol/geom/Circle} */ (geometry as Circle).getCenter();
					break;
				case GeometryType.MULTI_LINE_STRING:
					flatCoordinates = /** @type {module:ol/geom/MultiLineString} */ (geometry as MultiLineString).getFlatMidpoints();
					end = flatCoordinates.length;
					break;
				case GeometryType.POLYGON:
					flatCoordinates = /** @type {module:ol/geom/Polygon} */ (geometry as Polygon).getFlatInteriorPoint();
					if (!textState.overflow && flatCoordinates[2] / this.resolution < width) {
						return;
					}
					stride = 3;
					break;
				case GeometryType.MULTI_POLYGON:
					const interiorPoints = /** @type {module:ol/geom/MultiPolygon} */ (geometry as MultiPolygon).getFlatInteriorPoints();
					flatCoordinates = [];
					for (let i = 0, ii = interiorPoints.length; i < ii; i += 3) {
						if (textState.overflow || interiorPoints[i + 2] / this.resolution >= width) {
							flatCoordinates.push(interiorPoints[i], interiorPoints[i + 1]);
						}
					}
					end = flatCoordinates.length;
					if (end === 0) {
						return;
					}
					break;
				default:
			}
			end = this.appendFlatCoordinates(flatCoordinates!, 0, end, stride, false, false);
			if (textState.backgroundFill || textState.backgroundStroke) {
				this.setFillStrokeStyle(textState.backgroundFill, textState.backgroundStroke);
				if (textState.backgroundFill) {
					this.updateFillStyle(this.state, (state, geo) => {
						return this.createFill(state, geo);
					}, geometry);
					this.hitDetectionInstructions.push(this.createFill(this.state, geometry));
				}
				if (textState.backgroundStroke) {
					this.updateStrokeStyle(this.state, (state) => {
						return this.applyStroke(state);
					});
					this.hitDetectionInstructions.push(this.createStroke(this.state));
				}
			}
			this.beginGeometry(geometry, feature);
			this.drawTextImage_(label, begin, end);
			this.endGeometry(geometry, feature);
		}
	}


	/**
	 * @param {string} text Text.
	 * @param {string} textKey Text style key.
	 * @param {string} fillKey Fill style key.
	 * @param {string} strokeKey Stroke style key.
	 * @return {HTMLCanvasElement} Image.
	 */
	public getImage(text: string, textKey: string, fillKey: string, strokeKey: string) {
		let label;
		const key = strokeKey + textKey + text + fillKey + this.pixelRatio;

		if (!labelCache.containsKey(key)) {
			const strokeState = strokeKey ? this.strokeStates[strokeKey] || this.textStrokeState_ : null!;
			const fillState = fillKey ? this.fillStates[fillKey] || this.textFillState_ : null;
			const textState = this.textStates![textKey] || this.textState_;
			const pixelRatio = this.pixelRatio;
			const scale = textState.scale * pixelRatio;
			const align = TEXT_ALIGN[textState.textAlign as TEXT_ALIGN || defaultTextAlign] as number;
			const strokeWidth = strokeKey && strokeState.lineWidth ? strokeState.lineWidth : 0;

			const lines = text.split('\n');
			const numLines = lines.length;
			const widths: number[] = [];
			const width = measureTextWidths(textState.font, lines, widths);
			const lineHeight = measureTextHeight(textState.font);
			const height = lineHeight * numLines;
			const renderWidth = (width + strokeWidth);
			const context = createCanvasContext2D(
				Math.ceil(renderWidth * scale),
				Math.ceil((height + strokeWidth) * scale));
			label = context.canvas;
			labelCache.set(key, label);
			if (scale !== 1) {
				context.scale(scale, scale);
			}
			context.font = textState.font;
			if (strokeKey) {
				context.strokeStyle = strokeState.strokeStyle;
				context.lineWidth = strokeWidth;
				context.lineCap = strokeState.lineCap;
				context.lineJoin = strokeState.lineJoin;
				context.miterLimit = strokeState.miterLimit;
				if (CANVAS_LINE_DASH && strokeState.lineDash.length) {
					context.setLineDash(strokeState.lineDash);
					context.lineDashOffset = strokeState.lineDashOffset;
				}
			}
			if (fillKey) {
				context.fillStyle = fillState!.fillStyle!;
			}
			context.textBaseline = 'middle';
			context.textAlign = 'center';
			const leftRight = (0.5 - align);
			const x = align * label.width / scale + leftRight * strokeWidth;
			let i;
			if (strokeKey) {
				for (i = 0; i < numLines; ++i) {
					context.strokeText(lines[i], x + leftRight * widths[i], 0.5 * (strokeWidth + lineHeight) + i * lineHeight);
				}
			}
			if (fillKey) {
				for (i = 0; i < numLines; ++i) {
					context.fillText(lines[i], x + leftRight * widths[i], 0.5 * (strokeWidth + lineHeight) + i * lineHeight);
				}
			}
		}
		return labelCache.get(key);
	}

	/**
	 * @inheritDoc
	 */
	public setTextStyle(textStyle: Text, declutterGroup?: DeclutterGroup) {
		let textState;
		let fillState;
		let strokeState;
		if (!textStyle) {
			this.text_ = '';
		} else {
			this.declutterGroup_ = /** @type {module:ol/render/canvas~DeclutterGroup} */ (declutterGroup);

			const textFillStyle = textStyle.getFill();
			if (!textFillStyle) {
				fillState = this.textFillState_ = null;
			} else {
				fillState = this.textFillState_;
				if (!fillState) {
					fillState = this.textFillState_ = /** @type {module:ol/render/canvas~FillState} */ ({});
				}
				fillState.fillStyle = asColorLike(
					textFillStyle.getColor() || defaultFillStyle);
			}

			const textStrokeStyle = textStyle.getStroke();
			if (!textStrokeStyle) {
				strokeState = this.textStrokeState_ = null;
			} else {
				strokeState = this.textStrokeState_;
				if (!strokeState) {
					strokeState = this.textStrokeState_ = /** @type {module:ol/render/canvas~StrokeState} */ ({} as StrokeState);
				}
				const lineDash = textStrokeStyle.getLineDash();
				const lineDashOffset = textStrokeStyle.getLineDashOffset();
				const lineWidth = textStrokeStyle.getWidth();
				const miterLimit = textStrokeStyle.getMiterLimit();
				strokeState.lineCap = textStrokeStyle.getLineCap() || defaultLineCap;
				strokeState.lineDash = lineDash ? lineDash.slice() : defaultLineDash;
				strokeState.lineDashOffset =
					lineDashOffset === undefined ? defaultLineDashOffset : lineDashOffset;
				strokeState.lineJoin = textStrokeStyle.getLineJoin() || defaultLineJoin;
				strokeState.lineWidth =
					lineWidth === undefined ? defaultLineWidth : lineWidth;
				strokeState.miterLimit =
					miterLimit === undefined ? defaultMiterLimit : miterLimit;
				strokeState.strokeStyle = asColorLike(
					textStrokeStyle.getColor() || defaultStrokeStyle);
			}

			textState = this.textState_;
			const font = textStyle.getFont() || defaultFont;
			checkFont(font);
			const textScale = textStyle.getScale();
			textState.overflow = textStyle.getOverflow();
			textState.font = font;
			textState.maxAngle = textStyle.getMaxAngle();
			textState.placement = textStyle.getPlacement();
			textState.textAlign = textStyle.getTextAlign()!;
			textState.textBaseline = textStyle.getTextBaseline() || defaultTextBaseline;
			textState.backgroundFill = textStyle.getBackgroundFill()!;
			textState.backgroundStroke = textStyle.getBackgroundStroke()!;
			textState.padding = textStyle.getPadding() || defaultPadding;
			textState.scale = textScale === undefined ? 1 : textScale;

			const textOffsetX = textStyle.getOffsetX();
			const textOffsetY = textStyle.getOffsetY();
			const textRotateWithView = textStyle.getRotateWithView();
			const textRotation = textStyle.getRotation();
			this.text_ = textStyle.getText() || '';
			this.textOffsetX_ = textOffsetX === undefined ? 0 : textOffsetX;
			this.textOffsetY_ = textOffsetY === undefined ? 0 : textOffsetY;
			this.textRotateWithView_ = textRotateWithView === undefined ? false : textRotateWithView;
			this.textRotation_ = textRotation === undefined ? 0 : textRotation;

			this.strokeKey_ = strokeState ?
				(typeof strokeState.strokeStyle === 'string' ? strokeState.strokeStyle : getUid(strokeState.strokeStyle)) +
				strokeState.lineCap + strokeState.lineDashOffset + '|' + strokeState.lineWidth +
				strokeState.lineJoin + strokeState.miterLimit + '[' + strokeState.lineDash.join() + ']' :
				'';
			this.textKey_ = textState.font + textState.scale + (textState.textAlign || '?');
			this.fillKey_ = fillState ?
				(typeof fillState.fillStyle === 'string' ? fillState.fillStyle : ('|' + getUid(fillState.fillStyle))) :
				'';
		}
	}


	/**
	 * @private
	 * @param {HTMLCanvasElement} label Label.
	 * @param {number} begin Begin.
	 * @param {number} end End.
	 */
	private drawTextImage_(label: HTMLCanvasElement, begin: number, end: number) {
		const textState = this.textState_;
		const strokeState = this.textStrokeState_;
		const pixelRatio = this.pixelRatio;
		const align = TEXT_ALIGN[textState.textAlign as any as TEXT_ALIGN || defaultTextAlign] as number;
		const baseline = TEXT_ALIGN[textState.textBaseline as any as TEXT_ALIGN] as any as number;
		const strokeWidth = strokeState && strokeState.lineWidth ? strokeState.lineWidth : 0;

		const anchorX = align * label.width / pixelRatio + 2 * (0.5 - align) * strokeWidth;
		const anchorY = baseline * label.height / pixelRatio + 2 * (0.5 - baseline) * strokeWidth;
		this.instructions.push([CanvasInstruction.DRAW_IMAGE, begin, end,
			label, (anchorX - this.textOffsetX_) * pixelRatio, (anchorY - this.textOffsetY_) * pixelRatio,
		this.declutterGroup_, label.height, 1, 0, 0, this.textRotateWithView_, this.textRotation_,
			1, true, label.width,
		textState.padding === defaultPadding ?
			defaultPadding : textState.padding.map((p) => {
				return p * pixelRatio;
			}),
		!!textState.backgroundFill, !!textState.backgroundStroke
		]);
		this.hitDetectionInstructions.push([CanvasInstruction.DRAW_IMAGE, begin, end,
			label, (anchorX - this.textOffsetX_) * pixelRatio, (anchorY - this.textOffsetY_) * pixelRatio,
		this.declutterGroup_, label.height, 1, 0, 0, this.textRotateWithView_, this.textRotation_,
		1 / pixelRatio, true, label.width, textState.padding,
		!!textState.backgroundFill, !!textState.backgroundStroke
		]);
	}


	/**
	 * @private
	 * @param {number} begin Begin.
	 * @param {number} end End.
	 * @param {module:ol/render/canvas~DeclutterGroup} declutterGroup Declutter group.
	 */
	private drawChars_(begin: number, end: number, declutterGroup: DeclutterGroup) {
		const strokeState = this.textStrokeState_;
		const textState = this.textState_;
		const fillState = this.textFillState_;

		const strokeKey = this.strokeKey_;
		if (strokeState) {
			if (!(strokeKey in this.strokeStates)) {
				this.strokeStates[strokeKey] = /** @type {module:ol/render/canvas~StrokeState} */ ({
					lineCap: strokeState.lineCap,
					lineDash: strokeState.lineDash,
					lineDashOffset: strokeState.lineDashOffset,
					lineJoin: strokeState.lineJoin,
					lineWidth: strokeState.lineWidth,
					miterLimit: strokeState.miterLimit,
					strokeStyle: strokeState.strokeStyle
				});
			}
		}
		const textKey = this.textKey_;
		if (!(this.textKey_ in this.textStates!)) {
			this.textStates![this.textKey_] = /** @type {module:ol/render/canvas~TextState} */ ({
				font: textState.font,
				scale: textState.scale,
				textAlign: textState.textAlign || defaultTextAlign
			} as TextState);
		}
		const fillKey = this.fillKey_;
		if (fillState) {
			if (!(fillKey in this.fillStates)) {
				this.fillStates[fillKey] = /** @type {module:ol/render/canvas~FillState} */ ({
					fillStyle: fillState.fillStyle
				});
			}
		}

		const pixelRatio = this.pixelRatio;
		const baseline = TEXT_ALIGN[textState.textBaseline as any];

		const offsetY = this.textOffsetY_ * pixelRatio;
		const text = this.text_;
		const font = textState.font;
		const textScale = textState.scale;
		const strokeWidth = strokeState ? strokeState.lineWidth * textScale / 2 : 0;
		let widths = this.widths_[font];
		if (!widths) {
			this.widths_[font] = widths = {};
		}
		this.instructions.push([CanvasInstruction.DRAW_CHARS,
			begin, end, baseline, declutterGroup,
		textState.overflow, fillKey, textState.maxAngle,
		(txt: string) => {
			let width = widths[txt];
			if (!width) {
				width = widths[txt] = measureTextWidth(font, txt);
			}
			return width * textScale * pixelRatio;
		},
			offsetY, strokeKey, strokeWidth * pixelRatio, text, textKey, 1
		]);
		this.hitDetectionInstructions.push([CanvasInstruction.DRAW_CHARS,
			begin, end, baseline, declutterGroup,
		textState.overflow, fillKey, textState.maxAngle,
		(txt: string) => {
			let width = widths[txt];
			if (!width) {
				width = widths[txt] = measureTextWidth(font, txt);
			}
			return width * textScale;
		},
			offsetY, strokeKey, strokeWidth, text, textKey, 1 / pixelRatio
		]);
	}
}

/**
 * @param {string} font Font to use for measuring.
 * @param {Array.<string>} lines Lines to measure.
 * @param {Array.<number>} widths Array will be populated with the widths of
 * each line.
 * @return {number} Width of the whole text.
 */
export function measureTextWidths(font: string, lines: string[], widths: number[]) {
	const numLines = lines.length;
	let width = 0;
	for (let i = 0; i < numLines; ++i) {
		const currentWidth = measureTextWidth(font, lines[i]);
		width = Math.max(width, currentWidth);
		widths.push(currentWidth);
	}
	return width;
}
