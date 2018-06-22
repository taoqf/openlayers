/**
 * @module ol/style/Stroke
 */
import { Color } from '../color';
import { ColorLike } from '../colorlike';
import { getUid } from '../index';


/**
 * @typedef {Object} Options
 * @property {module:ol/color~Color|module:ol/colorlike~ColorLike} [color] A color, gradient or pattern.
 * See {@link module:ol/color~Color} and {@link module:ol/colorlike~ColorLike} for possible formats.
 * Default null; if null, the Canvas/renderer default black will be used.
 * @property {string} [lineCap='round'] Line cap style: `butt`, `round`, or `square`.
 * @property {string} [lineJoin='round'] Line join style: `bevel`, `round`, or `miter`.
 * @property {Array.<number>} [lineDash] Line dash pattern. Default is `undefined` (no dash).
 * Please note that Internet Explorer 10 and lower do not support the `setLineDash` method on
 * the `CanvasRenderingContext2D` and therefore this option will have no visual effect in these browsers.
 * @property {number} [lineDashOffset=0] Line dash offset.
 * @property {number} [miterLimit=10] Miter limit.
 * @property {number} [width] Width.
 */

export interface Options {
	color: Color | ColorLike;
	lineCap: 'butt' | 'round' | 'square' | string;
	lineJoin: 'bevel' | 'round' | 'miter' | string;
	lineDash: number[];
	lineDashOffset: number;
	miterLimit: number;
	width: number;
}

/**
 * @classdesc
 * Set stroke style for vector features.
 * Note that the defaults given are the Canvas defaults, which will be used if
 * option is not defined. The `get` functions return whatever was entered in
 * the options; they will not return the default.
 *
 * @constructor
 * @param {module:ol/style/Stroke~Options=} opt_options Options.
 * @api
 */
export default class Stroke {
	private color: Color | ColorLike | null;
	private lineCap: string | undefined;
	private lineDash: number[] | null;
	private lineDashOffset: number | undefined;
	private lineJoin: string | undefined;
	private miterLimit: number | undefined;
	private width: number | undefined;
	private checksum: string | undefined;
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options || {};

		/**
		 * @private
		 * @type {module:ol/color~Color|module:ol/colorlike~ColorLike}
		 */
		this.color = options.color !== undefined ? options.color : null;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.lineCap = options.lineCap;

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.lineDash = options.lineDash !== undefined ? options.lineDash : null;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.lineDashOffset = options.lineDashOffset;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.lineJoin = options.lineJoin;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.miterLimit = options.miterLimit;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.width = options.width;

		/**
		 * @private
		 * @type {string|undefined}
		 */
		this.checksum = undefined;
	}


	/**
	 * Clones the style.
	 * @return {module:ol/style/Stroke} The cloned style.
	 * @api
	 */
	public clone() {
		const color = this.getColor();
		return new Stroke({
			color: (color && (color as Color).slice) ? (color as Color).slice() as Color : color || undefined,
			lineCap: this.getLineCap(),
			lineDash: this.getLineDash() ? this.getLineDash()!.slice() : undefined,
			lineDashOffset: this.getLineDashOffset(),
			lineJoin: this.getLineJoin(),
			miterLimit: this.getMiterLimit(),
			width: this.getWidth()
		});
	}


	/**
	 * Get the stroke color.
	 * @return {module:ol/color~Color|module:ol/colorlike~ColorLike} Color.
	 * @api
	 */
	public getColor() {
		return this.color;
	}


	/**
	 * Get the line cap type for the stroke.
	 * @return {string|undefined} Line cap.
	 * @api
	 */
	public getLineCap() {
		return this.lineCap;
	}


	/**
	 * Get the line dash style for the stroke.
	 * @return {Array.<number>} Line dash.
	 * @api
	 */
	public getLineDash() {
		return this.lineDash;
	}


	/**
	 * Get the line dash offset for the stroke.
	 * @return {number|undefined} Line dash offset.
	 * @api
	 */
	public getLineDashOffset() {
		return this.lineDashOffset;
	}


	/**
	 * Get the line join type for the stroke.
	 * @return {string|undefined} Line join.
	 * @api
	 */
	public getLineJoin() {
		return this.lineJoin;
	}


	/**
	 * Get the miter limit for the stroke.
	 * @return {number|undefined} Miter limit.
	 * @api
	 */
	public getMiterLimit() {
		return this.miterLimit;
	}


	/**
	 * Get the stroke width.
	 * @return {number|undefined} Width.
	 * @api
	 */
	public getWidth() {
		return this.width;
	}


	/**
	 * Set the color.
	 *
	 * @param {module:ol/color~Color|module:ol/colorlike~ColorLike} color Color.
	 * @api
	 */
	public setColor(color: Color | ColorLike) {
		this.color = color;
		this.checksum = undefined;
	}


	/**
	 * Set the line cap.
	 *
	 * @param {string|undefined} lineCap Line cap.
	 * @api
	 */
	public setLineCap(lineCap?: string) {
		this.lineCap = lineCap;
		this.checksum = undefined;
	}


	/**
	 * Set the line dash.
	 *
	 * Please note that Internet Explorer 10 and lower [do not support][mdn] the
	 * `setLineDash` method on the `CanvasRenderingContext2D` and therefore this
	 * property will have no visual effect in these browsers.
	 *
	 * [mdn]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash#Browser_compatibility
	 *
	 * @param {Array.<number>} lineDash Line dash.
	 * @api
	 */
	public setLineDash(lineDash: number[]) {
		this.lineDash = lineDash;
		this.checksum = undefined;
	}


	/**
	 * Set the line dash offset.
	 *
	 * @param {number|undefined} lineDashOffset Line dash offset.
	 * @api
	 */
	public setLineDashOffset(lineDashOffset?: number) {
		this.lineDashOffset = lineDashOffset;
		this.checksum = undefined;
	}


	/**
	 * Set the line join.
	 *
	 * @param {string|undefined} lineJoin Line join.
	 * @api
	 */
	public setLineJoin(lineJoin?: string) {
		this.lineJoin = lineJoin;
		this.checksum = undefined;
	}


	/**
	 * Set the miter limit.
	 *
	 * @param {number|undefined} miterLimit Miter limit.
	 * @api
	 */
	public setMiterLimit(miterLimit?: number) {
		this.miterLimit = miterLimit;
		this.checksum = undefined;
	}


	/**
	 * Set the width.
	 *
	 * @param {number|undefined} width Width.
	 * @api
	 */
	public setWidth(width?: number) {
		this.width = width;
		this.checksum = undefined;
	}


	/**
	 * @return {string} The checksum.
	 */
	public getChecksum() {
		if (this.checksum === undefined) {
			this.checksum = 's';
			if (this.color) {
				if (typeof this.color === 'string') {
					this.checksum += this.color;
				} else {
					this.checksum += getUid(this.color).toString();
				}
			} else {
				this.checksum += '-';
			}
			this.checksum += ',' +
				(this.lineCap !== undefined ?
					this.lineCap.toString() : '-') + ',' +
				(this.lineDash ?
					this.lineDash.toString() : '-') + ',' +
				(this.lineDashOffset !== undefined ?
					this.lineDashOffset : '-') + ',' +
				(this.lineJoin !== undefined ?
					this.lineJoin : '-') + ',' +
				(this.miterLimit !== undefined ?
					this.miterLimit.toString() : '-') + ',' +
				(this.width !== undefined ?
					this.width.toString() : '-');
		}

		return this.checksum;
	}
}
