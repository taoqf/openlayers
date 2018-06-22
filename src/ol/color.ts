/**
 * @module ol/color
 */
import { assert } from './asserts';
import { clamp } from './math';


/**
 * A color represented as a short array [red, green, blue, alpha].
 * red, green, and blue should be integers in the range 0..255 inclusive.
 * alpha should be a float in the range 0..1 inclusive. If no alpha value is
 * given then `1` will be used.
 * @typedef {Array.<number>} Color
 * @api
 */

export type Color = [number, number, number, number];

/**
 * This RegExp matches # followed by 3, 4, 6, or 8 hex digits.
 * @const
 * @type {RegExp}
 * @private
 */
const HEX_COLOR_RE_ = /^#([a-f0-9]{3}|[a-f0-9]{4}(?:[a-f0-9]{2}){0,2})$/i;


/**
 * Regular expression for matching potential named color style strings.
 * @const
 * @type {RegExp}
 * @private
 */
const NAMED_COLOR_RE_ = /^([a-z]*)$/i;


/**
 * Return the color as an rgba string.
 * @param {module:ol/color~Color|string} color Color.
 * @return {string} Rgba string.
 * @api
 */
export function asString(color: Color | string) {
	if (typeof color === 'string') {
		return color;
	} else {
		return toString(color);
	}
}

/**
 * Return named color as an rgba string.
 * @param {string} color Named color.
 * @return {string} Rgb string.
 */
function fromNamed(color: string) {
	const el = document.createElement('div');
	el.style.color = color;
	if (el.style.color !== '') {
		document.body.appendChild(el);
		const rgb = getComputedStyle(el).color as string;
		document.body.removeChild(el);
		return rgb;
	} else {
		return '';
	}
}


/**
 * @param {string} s String.
 * @return {module:ol/color~Color} Color.
 */
export const fromString = (() => {

	// We maintain a small cache of parsed strings.  To provide cheap LRU-like
	// semantics, whenever the cache grows too large we simply delete an
	// arbitrary 25% of the entries.

	/**
	 * @const
	 * @type {number}
	 */
	const MAX_CACHE_SIZE = 1024;

	/**
	 * @type {Object.<string, module:ol/color~Color>}
	 */
	const cache = {} as { [name: string]: Color; };

	/**
	 * @type {number}
	 */
	let cacheSize = 0;

	/**
	 * @param {string} s String.
	 * @return {module:ol/color~Color} Color.
	 */
	return (s: string) => {
		let color: Color;
		if (cache.hasOwnProperty(s)) {
			color = cache[s];
		} else {
			if (cacheSize >= MAX_CACHE_SIZE) {
				let i = 0;
				for (const key in cache) {
					if ((i++ & 3) === 0) {
						delete cache[key];
						--cacheSize;
					}
				}
			}
			color = fromStringInternal_(s);
			cache[s] = color;
			++cacheSize;
		}
		return color;
	};
})();

/**
 * Return the color as an array. This function maintains a cache of calculated
 * arrays which means the result should not be modified.
 * @param {module:ol/color~Color|string} color Color.
 * @return {module:ol/color~Color} Color.
 * @api
 */
export function asArray(color: Color | string) {
	if (Array.isArray(color)) {
		return color;
	} else {
		return fromString(/** @type {string} */(color));
	}
}

/**
 * @param {string} ss String.
 * @private
 * @return {module:ol/color~Color} Color.
 */
function fromStringInternal_(s: string) {
	let color: Color;

	const ss = NAMED_COLOR_RE_.exec(s) ? fromNamed(s) : s;

	if (HEX_COLOR_RE_.exec(ss)) { // hex
		const n = ss.length - 1; // number of hex digits
		let d; // number of digits per channel
		if (n <= 4) {
			d = 1;
		} else {
			d = 2;
		}
		const hasAlpha = n === 4 || n === 8;
		let r = parseInt(ss.substr(1 + 0 * d, d), 16);
		let g = parseInt(ss.substr(1 + 1 * d, d), 16);
		let b = parseInt(ss.substr(1 + 2 * d, d), 16);
		let a = hasAlpha ? parseInt(ss.substr(1 + 3 * d, d), 16) : 255;
		if (d === 1) {
			r = (r << 4) + r;
			g = (g << 4) + g;
			b = (b << 4) + b;
			if (hasAlpha) {
				a = (a << 4) + a;
			}
		}
		color = [r, g, b, a / 255];
	} else if (ss.indexOf('rgba(') === 0) { // rgba()
		color = ss.slice(5, -1).split(',').map(Number) as Color;
		normalize(color);
	} else if (ss.indexOf('rgb(') === 0) { // rgb()
		color = ss.slice(4, -1).split(',').map(Number) as Color;
		color.push(1);
		normalize(color);
	} else {
		assert(false, 14); // Invalid color
	}
	return color!;
}


/**
 * TODO this function is only used in the test, we probably shouldn't export it
 * @param {module:ol/color~Color} color Color.
 * @return {module:ol/color~Color} Clamped color.
 */
export function normalize(color: Color) {
	color[0] = clamp((color[0] + 0.5) | 0, 0, 255);
	color[1] = clamp((color[1] + 0.5) | 0, 0, 255);
	color[2] = clamp((color[2] + 0.5) | 0, 0, 255);
	color[3] = clamp(color[3], 0, 1);
	return color;
}


/**
 * @param {module:ol/color~Color} color Color.
 * @return {string} String.
 */
export function toString(color: Color) {
	let r = color[0];
	if (r !== (r | 0)) {
		r = (r + 0.5) | 0;
	}
	let g = color[1];
	if (g !== (g | 0)) {
		g = (g + 0.5) | 0;
	}
	let b = color[2];
	if (b !== (b | 0)) {
		b = (b + 0.5) | 0;
	}
	const a = color[3] === undefined ? 1 : color[3];
	return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}
