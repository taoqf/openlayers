/**
 * @module ol/render/canvas
 */
import { Color } from '../color';
import { ColorLike } from '../colorlike';
import { getFontFamilies } from '../css';
import { createCanvasContext2D } from '../dom';
import { clear } from '../obj';
import LRUCache from '../structs/LRUCache';
import { create as createTransform, Transform } from '../transform';
import { TEXT_ALIGN } from './replay';


/**
 * @typedef {Object} FillState
 * @property {module:ol/colorlike~ColorLike} fillStyle
 */

export interface FillState {
	fillStyle?: ColorLike;
}

/**
 * @typedef {Object} FillStrokeState
 * @property {module:ol/colorlike~ColorLike} [currentFillStyle]
 * @property {module:ol/colorlike~ColorLike} [currentStrokeStyle]
 * @property {string} [currentLineCap]
 * @property {Array.<number>} currentLineDash
 * @property {number} [currentLineDashOffset]
 * @property {string} [currentLineJoin]
 * @property {number} [currentLineWidth]
 * @property {number} [currentMiterLimit]
 * @property {number} [lastStroke]
 * @property {module:ol/colorlike~ColorLike} [fillStyle]
 * @property {module:ol/colorlike~ColorLike} [strokeStyle]
 * @property {string} [lineCap]
 * @property {Array.<number>} lineDash
 * @property {number} [lineDashOffset]
 * @property {string} [lineJoin]
 * @property {number} [lineWidth]
 * @property {number} [miterLimit]
 */

export interface FillStrokeState {
	currentFillStyle: ColorLike;
	currentStrokeStyle: ColorLike;
	currentLineCap: string;
	currentLineDash: number[];
	currentLineDashOffset: number;
	currentLineJoin: string;
	currentLineWidth: number;
	currentMiterLimit: number;
	lastStroke: number;
	fillStyle: ColorLike;
	strokeStyle: ColorLike;
	lineCap: string;
	lineDash: number[] | null;
	lineDashOffset: number;
	lineJoin: string;
	lineWidth: number;
	miterLimit: number;
}

/**
 * @typedef {Object} StrokeState
 * @property {string} lineCap
 * @property {Array.<number>} lineDash
 * @property {number} lineDashOffset
 * @property {string} lineJoin
 * @property {number} lineWidth
 * @property {number} miterLimit
 * @property {module:ol/colorlike~ColorLike} strokeStyle
 */

export interface StrokeState {
	lineCap: string;
	lineDash: number[];
	lineDashOffset: number;
	lineJoin: string;
	lineWidth: number;
	miterLimit: number;
	strokeStyle: ColorLike;
}

/**
 * @typedef {Object} TextState
 * @property {string} font
 * @property {string} [textAlign]
 * @property {string} textBaseline
 */

export interface TextState {
	font: string;
	scale: number;
	textAlign?: TEXT_ALIGN | string;
	textBaseline: string;
}

/**
 * Container for decluttered replay instructions that need to be rendered or
 * omitted together, i.e. when styles render both an image and text, or for the
 * characters that form text along lines. The basic elements of this array are
 * `[minX, minY, maxX, maxY, count]`, where the first four entries are the
 * rendered extent of the group in pixel space. `count` is the number of styles
 * in the group, i.e. 2 when an image and a text are grouped, or 1 otherwise.
 * In addition to these four elements, declutter instruction arrays (i.e. the
 * arguments to {@link module:ol/render/canvas~drawImage} are appended to the array.
 * @typedef {Array.<*>} DeclutterGroup
 */

export type DeclutterGroup = any[];

/**
 * @const
 * @type {string}
 */
export const defaultFont = '10px sans-serif';


/**
 * @const
 * @type {module:ol/color~Color}
 */
export const defaultFillStyle: Color = [0, 0, 0, 1];


/**
 * @const
 * @type {string}
 */
export const defaultLineCap = 'round';


/**
 * @const
 * @type {Array.<number>}
 */
export const defaultLineDash = [];


/**
 * @const
 * @type {number}
 */
export const defaultLineDashOffset = 0;


/**
 * @const
 * @type {string}
 */
export const defaultLineJoin = 'round';


/**
 * @const
 * @type {number}
 */
export const defaultMiterLimit = 10;


/**
 * @const
 * @type {module:ol/color~Color}
 */
export const defaultStrokeStyle: Color = [0, 0, 0, 1];


/**
 * @const
 * @type {string}
 */
export const defaultTextAlign = 'center';


/**
 * @const
 * @type {string}
 */
export const defaultTextBaseline = 'middle';


/**
 * @const
 * @type {Array.<number>}
 */
export const defaultPadding = [0, 0, 0, 0];


/**
 * @const
 * @type {number}
 */
export const defaultLineWidth = 1;


/**
 * The label cache for text rendering. To change the default cache size of 2048
 * entries, use {@link module:ol/structs/LRUCache#setSize}.
 * @type {module:ol/structs/LRUCache.<HTMLCanvasElement>}
 * @api
 */
export const labelCache = new LRUCache<HTMLCanvasElement>();


/**
 * @type {!Object.<string, number>}
 */
export const checkedFonts = {} as { [font: string]: number; };


/**
 * @type {CanvasRenderingContext2D}
 */
let measureContext: CanvasRenderingContext2D | null = null;


/**
 * @type {!Object.<string, number>}
 */
export const textHeights = {} as { [font: string]: number | undefined; };


/**
 * Clears the label cache when a font becomes available.
 * @param {string} fontSpec CSS font spec.
 */
export const checkFont = (() => {
	const retries = 60;
	const checked = checkedFonts;
	const size = '32px ';
	const referenceFonts = ['monospace', 'serif'];
	const len = referenceFonts.length;
	const text = 'wmytzilWMYTZIL@#/&?$%10\uF013';
	let interval: number | null | undefined;

	function isAvailable(font: string) {
		const context = getMeasureContext();
		let available = true;
		for (let i = 0; i < len; ++i) {
			const referenceFont = referenceFonts[i];
			context.font = size + referenceFont;
			const referenceWidth = context.measureText(text).width;
			if (font !== referenceFont) {
				context.font = size + font + ',' + referenceFont;
				const width = context.measureText(text).width;
				// If width and referenceWidth are the same, then the fallback was used
				// instead of the font we wanted, so the font is not available.
				available = available && width !== referenceWidth;
			}
		}
		return available;
	}

	function check() {
		let done = true;
		for (const font in checked) {
			if (checked[font] < retries) {
				if (isAvailable(font)) {
					checked[font] = retries;
					clear(textHeights);
					// Make sure that loaded fonts are picked up by Safari
					measureContext = null;
					labelCache.clear();
				} else {
					++checked[font];
					done = false;
				}
			}
		}
		if (done) {
			clearInterval(interval!);
			interval = undefined;
		}
	}

	return (fontSpec: string) => {
		const fontFamilies = getFontFamilies(fontSpec);
		if (!fontFamilies) {
			return;
		}
		for (let i = 0, ii = fontFamilies.length; i < ii; ++i) {
			const fontFamily = fontFamilies[i];
			if (!(fontFamily in checked)) {
				checked[fontFamily] = retries;
				if (!isAvailable(fontFamily)) {
					checked[fontFamily] = 0;
					if (interval === undefined) {
						interval = setInterval(check, 32);
					}
				}
			}
		}
	};
})();


/**
 * @return {CanvasRenderingContext2D} Measure context.
 */
function getMeasureContext() {
	if (!measureContext) {
		measureContext = createCanvasContext2D(1, 1);
	}
	return measureContext!;
}


/**
 * @param {string} font Font to use for measuring.
 * @return {module:ol/size~Size} Measurement.
 */
export const measureTextHeight = (() => {
	let span: HTMLSpanElement | undefined;
	const heights = textHeights;
	return (font: string) => {
		let height = heights[font];
		if (height === undefined) {
			if (!span) {
				span = document.createElement('span');
				span.textContent = 'M';
				span.style.margin = span.style.padding = '0 !important';
				span.style.position = 'absolute !important';
				span.style.left = '-99999px !important';
			}
			span.style.font = font;
			document.body.appendChild(span);
			height = heights[font] = span.offsetHeight;
			document.body.removeChild(span);
		}
		return height;
	};
})();


/**
 * @param {string} font Font.
 * @param {string} text Text.
 * @return {number} Width.
 */
export function measureTextWidth(font: string, text: string) {
	const measure_context = getMeasureContext();
	if (font !== measure_context.font) {
		measure_context.font = font;
	}
	return measure_context.measureText(text).width;
}


/**
 * @param {CanvasRenderingContext2D} context Context.
 * @param {number} rotation Rotation.
 * @param {number} offsetX X offset.
 * @param {number} offsetY Y offset.
 */
export function rotateAtOffset(context: CanvasRenderingContext2D, rotation: number, offsetX: number, offsetY: number) {
	if (rotation !== 0) {
		context.translate(offsetX, offsetY);
		context.rotate(rotation);
		context.translate(-offsetX, -offsetY);
	}
}


export const resetTransform = createTransform();


/**
 * @param {CanvasRenderingContext2D} context Context.
 * @param {module:ol/transform~Transform|null} transform Transform.
 * @param {number} opacity Opacity.
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} image Image.
 * @param {number} originX Origin X.
 * @param {number} originY Origin Y.
 * @param {number} w Width.
 * @param {number} h Height.
 * @param {number} x X.
 * @param {number} y Y.
 * @param {number} scale Scale.
 */
export function drawImage(context: CanvasRenderingContext2D, transform: Transform | null, opacity: number, image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement, originX: number, originY: number, w: number, h: number, x: number, y: number, scale: number) {
	let alpha;
	if (opacity !== 1) {
		alpha = context.globalAlpha;
		context.globalAlpha = alpha * opacity;
	}
	if (transform) {
		context.setTransform.apply(context, transform);
	}

	context.drawImage(image, originX, originY, w, h, x, y, w * scale, h * scale);

	if (alpha) {
		context.globalAlpha = alpha;
	}
	if (transform) {
		context.setTransform.apply(context, resetTransform);
	}
}
