/**
 * @module ol/style/Text
 */
import Fill from '../style/Fill';
import Stroke from './Stroke';
import TextPlacement from './TextPlacement';


/**
 * The default fill color to use if no fill was set at construction time; a
 * blackish `#333`.
 *
 * @const {string}
 */
const DEFAULT_FILL_COLOR = '#333';


/**
 * @typedef {Object} Options
 * @property {string} [font] Font style as CSS 'font' value, see:
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font}. Default is '10px sans-serif'
 * @property {number} [maxAngle] When `placement` is set to `'line'`, allow a maximum angle between adjacent characters.
 * The expected value is in radians, and the default is 45° (`Math.PI / 4`).
 * @property {number} [offsetX=0] Horizontal text offset in pixels. A positive will shift the text right.
 * @property {number} [offsetY=0] Vertical text offset in pixels. A positive will shift the text down.
 * @property {boolean} [overflow=false] For polygon labels or when `placement` is set to `'line'`, allow text to exceed
 * the width of the polygon at the label position or the length of the path that it follows.
 * @property {module:ol/style/TextPlacement|string} [placement] Text placement.
 * @property {number} [scale] Scale.
 * @property {boolean} [rotateWithView=false] Whether to rotate the text with the view.
 * @property {number} [rotation=0] Rotation in radians (positive rotation clockwise).
 * @property {string} [text] Text content.
 * @property {string} [textAlign] Text alignment. Possible values: 'left', 'right', 'center', 'end' or 'start'.
 * Default is 'center' for `placement: 'point'`. For `placement: 'line'`, the default is to let the renderer choose a
 * placement where `maxAngle` is not exceeded.
 * @property {string} [textBaseline='middle'] Text base line. Possible values: 'bottom', 'top', 'middle', 'alphabetic',
 * 'hanging', 'ideographic'.
 * @property {module:ol/style/Fill} [fill] Fill style. If none is provided, we'll use a dark fill-style (#333).
 * @property {module:ol/style/Stroke} [stroke] Stroke style.
 * @property {module:ol/style/Fill} [backgroundFill] Fill style for the text background when `placement` is
 * `'point'`. Default is no fill.
 * @property {module:ol/style/Stroke} [backgroundStroke] Stroke style for the text background  when `placement`
 * is `'point'`. Default is no stroke.
 * @property {Array.<number>} [padding=[0, 0, 0, 0]] Padding in pixels around the text for decluttering and background. The order of
 * values in the array is `[top, right, bottom, left]`.
 */

export interface Options {
	font: string;
	maxAngle: number;
	offsetX: number;
	offsetY: number;
	overflow: boolean;
	placement: TextPlacement | string;
	scale: number;
	rotateWithView: boolean;
	rotation: number;
	text: string;
	textAlign: string;
	textBaseline: string;
	fill: Fill;
	stroke: Stroke;
	backgroundFill: Fill;
	backgroundStroke: Stroke;
	padding: number[];
}

/**
 * @classdesc
 * Set text style for vector features.
 *
 * @constructor
 * @param {module:ol/style/Text~Options=} opt_options Options.
 * @api
 */
export default class Text {
	private font: string | undefined;
	private rotation: number | undefined;
	private rotateWithView: boolean | undefined;
	private scale: number | undefined;
	private text: string | undefined;
	private textAlign: string | undefined;
	private textBaseline: string | undefined;
	private fill: Fill;
	private maxAngle: number;
	private placement: string;
	private overflow: boolean;
	private stroke: Stroke | null;
	private offsetX: number;
	private offsetY: number;
	private backgroundFill: Fill | null;
	private backgroundStroke: Stroke | null;
	private padding: number[] | null;
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options || {};

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.font = options.font;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.rotation = options.rotation;

		/**
		 * @private
		 * @type {boolean|undefined}
		 */
		this.rotateWithView = options.rotateWithView;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.scale = options.scale;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.text = options.text;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.textAlign = options.textAlign;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.textBaseline = options.textBaseline;

		/**
		 * @private
		 * @type {module:ol/style/Fill}
		 */
		this.fill = options.fill !== undefined ? options.fill :
			new Fill({ color: DEFAULT_FILL_COLOR });

		/**
		 * @private
		 * @type {number}
		 */
		this.maxAngle = options.maxAngle !== undefined ? options.maxAngle : Math.PI / 4;

		/**
		 * @private
		 * @type {module:ol/style/TextPlacement|string}
		 */
		this.placement = options.placement !== undefined ? options.placement : TextPlacement.POINT;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.overflow = !!options.overflow;

		/**
		 * @private
		 * @type {module:ol/style/Stroke}
		 */
		this.stroke = options.stroke !== undefined ? options.stroke : null;

		/**
		 * @private
		 * @type {number}
		 */
		this.offsetX = options.offsetX !== undefined ? options.offsetX : 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.offsetY = options.offsetY !== undefined ? options.offsetY : 0;

		/**
		 * @private
		 * @type {module:ol/style/Fill}
		 */
		this.backgroundFill = options.backgroundFill ? options.backgroundFill : null;

		/**
		 * @private
		 * @type {module:ol/style/Stroke}
		 */
		this.backgroundStroke = options.backgroundStroke ? options.backgroundStroke : null;

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.padding = options.padding === undefined ? null : options.padding;
	}


	/**
	 * Clones the style.
	 * @return {module:ol/style/Text} The cloned style.
	 * @api
	 */
	public clone() {
		return new Text({
			backgroundFill: this.getBackgroundFill() ? this.getBackgroundFill()!.clone() : undefined,
			backgroundStroke: this.getBackgroundStroke() ? this.getBackgroundStroke()!.clone() : undefined,
			fill: this.getFill() ? this.getFill().clone() : undefined,
			font: this.getFont(),
			maxAngle: this.getMaxAngle(),
			offsetX: this.getOffsetX(),
			offsetY: this.getOffsetY(),
			overflow: this.getOverflow(),
			placement: this.getPlacement(),
			rotateWithView: this.getRotateWithView(),
			rotation: this.getRotation(),
			scale: this.getScale(),
			stroke: this.getStroke() ? this.getStroke()!.clone() : undefined,
			text: this.getText(),
			textAlign: this.getTextAlign(),
			textBaseline: this.getTextBaseline()
		});
	}


	/**
	 * Get the `overflow` configuration.
	 * @return {boolean} Let text overflow the length of the path they follow.
	 * @api
	 */
	public getOverflow() {
		return this.overflow;
	}


	/**
	 * Get the font name.
	 * @return {string|undefined} Font.
	 * @api
	 */
	public getFont() {
		return this.font;
	}


	/**
	 * Get the maximum angle between adjacent characters.
	 * @return {number} Angle in radians.
	 * @api
	 */
	public getMaxAngle() {
		return this.maxAngle;
	}


	/**
	 * Get the label placement.
	 * @return {module:ol/style/TextPlacement|string} Text placement.
	 * @api
	 */
	public getPlacement() {
		return this.placement;
	}


	/**
	 * Get the x-offset for the text.
	 * @return {number} Horizontal text offset.
	 * @api
	 */
	public getOffsetX() {
		return this.offsetX;
	}


	/**
	 * Get the y-offset for the text.
	 * @return {number} Vertical text offset.
	 * @api
	 */
	public getOffsetY() {
		return this.offsetY;
	}


	/**
	 * Get the fill style for the text.
	 * @return {module:ol/style/Fill} Fill style.
	 * @api
	 */
	public getFill() {
		return this.fill;
	}


	/**
	 * Determine whether the text rotates with the map.
	 * @return {boolean|undefined} Rotate with map.
	 * @api
	 */
	public getRotateWithView() {
		return this.rotateWithView;
	}


	/**
	 * Get the text rotation.
	 * @return {number|undefined} Rotation.
	 * @api
	 */
	public getRotation() {
		return this.rotation;
	}


	/**
	 * Get the text scale.
	 * @return {number|undefined} Scale.
	 * @api
	 */
	public getScale() {
		return this.scale;
	}


	/**
	 * Get the stroke style for the text.
	 * @return {module:ol/style/Stroke} Stroke style.
	 * @api
	 */
	public getStroke() {
		return this.stroke;
	}


	/**
	 * Get the text to be rendered.
	 * @return {string|undefined} Text.
	 * @api
	 */
	public getText() {
		return this.text;
	}


	/**
	 * Get the text alignment.
	 * @return {string|undefined} Text align.
	 * @api
	 */
	public getTextAlign() {
		return this.textAlign;
	}


	/**
	 * Get the text baseline.
	 * @return {string|undefined} Text baseline.
	 * @api
	 */
	public getTextBaseline() {
		return this.textBaseline;
	}


	/**
	 * Get the background fill style for the text.
	 * @return {module:ol/style/Fill} Fill style.
	 * @api
	 */
	public getBackgroundFill() {
		return this.backgroundFill;
	}


	/**
	 * Get the background stroke style for the text.
	 * @return {module:ol/style/Stroke} Stroke style.
	 * @api
	 */
	public getBackgroundStroke() {
		return this.backgroundStroke;
	}


	/**
	 * Get the padding for the text.
	 * @return {Array.<number>} Padding.
	 * @api
	 */
	public getPadding() {
		return this.padding;
	}


	/**
	 * Set the `overflow` property.
	 *
	 * @param {boolean} overflow Let text overflow the path that it follows.
	 * @api
	 */
	public setOverflow(overflow: boolean) {
		this.overflow = overflow;
	}


	/**
	 * Set the font.
	 *
	 * @param {string|undefined} font Font.
	 * @api
	 */
	public setFont(font: string | undefined) {
		this.font = font;
	}


	/**
	 * Set the maximum angle between adjacent characters.
	 *
	 * @param {number} maxAngle Angle in radians.
	 * @api
	 */
	public setMaxAngle(maxAngle: number) {
		this.maxAngle = maxAngle;
	}


	/**
	 * Set the x offset.
	 *
	 * @param {number} offsetX Horizontal text offset.
	 * @api
	 */
	public setOffsetX(offsetX: number) {
		this.offsetX = offsetX;
	}


	/**
	 * Set the y offset.
	 *
	 * @param {number} offsetY Vertical text offset.
	 * @api
	 */
	public setOffsetY(offsetY: number) {
		this.offsetY = offsetY;
	}


	/**
	 * Set the text placement.
	 *
	 * @param {module:ol/style/TextPlacement|string} placement Placement.
	 * @api
	 */
	public setPlacement(placement: TextPlacement | string) {
		this.placement = placement;
	}


	/**
	 * Set the fill.
	 *
	 * @param {module:ol/style/Fill} fill Fill style.
	 * @api
	 */
	public setFill(fill: Fill) {
		this.fill = fill;
	}


	/**
	 * Set the rotation.
	 *
	 * @param {number|undefined} rotation Rotation.
	 * @api
	 */
	public setRotation(rotation: number | undefined) {
		this.rotation = rotation;
	}


	/**
	 * Set the scale.
	 *
	 * @param {number|undefined} scale Scale.
	 * @api
	 */
	public setScale(scale: number | undefined) {
		this.scale = scale;
	}


	/**
	 * Set the stroke.
	 *
	 * @param {module:ol/style/Stroke} stroke Stroke style.
	 * @api
	 */
	public setStroke(stroke: Stroke) {
		this.stroke = stroke;
	}


	/**
	 * Set the text.
	 *
	 * @param {string|undefined} text Text.
	 * @api
	 */
	public setText(text: string | undefined) {
		this.text = text;
	}


	/**
	 * Set the text alignment.
	 *
	 * @param {string|undefined} textAlign Text align.
	 * @api
	 */
	public setTextAlign(textAlign: string | undefined) {
		this.textAlign = textAlign;
	}


	/**
	 * Set the text baseline.
	 *
	 * @param {string|undefined} textBaseline Text baseline.
	 * @api
	 */
	public setTextBaseline(textBaseline: string | undefined) {
		this.textBaseline = textBaseline;
	}


	/**
	 * Set the background fill.
	 *
	 * @param {module:ol/style/Fill} fill Fill style.
	 * @api
	 */
	public setBackgroundFill(fill: Fill) {
		this.backgroundFill = fill;
	}


	/**
	 * Set the background stroke.
	 *
	 * @param {module:ol/style/Stroke} stroke Stroke style.
	 * @api
	 */
	public setBackgroundStroke(stroke: Stroke) {
		this.backgroundStroke = stroke;
	}


	/**
	 * Set the padding (`[top, right, bottom, left]`).
	 *
	 * @param {!Array.<number>} padding Padding.
	 * @api
	 */
	public setPadding(padding: number[]) {
		this.padding = padding;
	}
}
