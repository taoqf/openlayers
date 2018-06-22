/**
 * @module ol/style/Fill
 */
import { asString, Color } from '../color';
import { ColorLike } from '../colorlike';
import { getUid } from '../index';


/**
 * @typedef {Object} Options
 * @property {module:ol/color~Color|module:ol/colorlike~ColorLike} [color] A color, gradient or pattern.
 * See {@link module:ol/color~Color} and {@link module:ol/colorlike~ColorLike} for possible formats.
 * Default null; if null, the Canvas/renderer default black will be used.
 */

export interface Options {
	color: Color | ColorLike;
}

/**
 * @classdesc
 * Set fill style for vector features.
 *
 * @constructor
 * @param {module:ol/style/Fill~Options=} opt_options Options.
 * @api
 */
export default class Fill {
	private color: Color | ColorLike | null;
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
		this.checksum = undefined;
	}


	/**
	 * Clones the style. The color is not cloned if it is an {@link module:ol/colorlike~ColorLike}.
	 * @return {module:ol/style/Fill} The cloned style.
	 * @api
	 */
	public clone() {
		const color = this.getColor();
		return new Fill({
			color: (color && (color as Color).slice) ? (color as Color).slice() as Color : color || undefined
		});
	}


	/**
	 * Get the fill color.
	 * @return {module:ol/color~Color|module:ol/colorlike~ColorLike} Color.
	 * @api
	 */
	public getColor() {
		return this.color;
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
	 * @return {string} The checksum.
	 */
	public getChecksum() {
		if (this.checksum === undefined) {
			if (
				this.color instanceof CanvasPattern ||
				this.color instanceof CanvasGradient
			) {
				this.checksum = getUid(this.color).toString();
			} else {
				this.checksum = 'f' + (this.color ? asString(this.color) : '-');
			}
		}

		return this.checksum;
	}
}
