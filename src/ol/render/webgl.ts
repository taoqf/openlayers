import { Color } from '../color';

/**
 * @module ol/render/webgl
 */


/**
 * @const
 * @type {string}
 */
export const DEFAULT_FONT = '10px sans-serif';


/**
 * @const
 * @type {module:ol/color~Color}
 */
export const DEFAULT_FILLSTYLE = [0.0, 0.0, 0.0, 1.0] as Color;


/**
 * @const
 * @type {string}
 */
export const DEFAULT_LINECAP = 'round';


/**
 * @const
 * @type {Array.<number>}
 */
export const DEFAULT_LINEDASH = [] as number[];


/**
 * @const
 * @type {number}
 */
export const DEFAULT_LINEDASHOFFSET = 0;


/**
 * @const
 * @type {string}
 */
export const DEFAULT_LINEJOIN = 'round';


/**
 * @const
 * @type {number}
 */
export const DEFAULT_MITERLIMIT = 10;

/**
 * @const
 * @type {module:ol/color~Color}
 */
export const DEFAULT_STROKESTYLE = [0.0, 0.0, 0.0, 1.0] as Color;


/**
 * @const
 * @type {number}
 */
export const DEFAULT_TEXTALIGN = 0.5;


/**
 * @const
 * @type {number}
 */
export const DEFAULT_TEXTBASELINE = 0.5;


/**
 * @const
 * @type {number}
 */
export const DEFAULT_LINEWIDTH = 1;

/**
 * @const
 * @type {number}
 */
export const EPSILON = Number.EPSILON || 2.220446049250313e-16;

/**
 * Calculates the orientation of a triangle based on the determinant method.
 * @param {number} x1 First X coordinate.
 * @param {number} y1 First Y coordinate.
 * @param {number} x2 Second X coordinate.
 * @param {number} y2 Second Y coordinate.
 * @param {number} x3 Third X coordinate.
 * @param {number} y3 Third Y coordinate.
 * @return {boolean|undefined} Triangle is clockwise.
 */
export const triangleIsCounterClockwise = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): boolean | undefined => {
	const area = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
	return (area <= EPSILON && area >= -EPSILON) ?
		undefined : area > 0;
};

