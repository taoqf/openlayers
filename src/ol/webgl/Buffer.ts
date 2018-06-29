/**
 * @module ol/webgl/Buffer
 */

import { DYNAMIC_DRAW, STATIC_DRAW, STREAM_DRAW } from '../webgl';

// ! fix tslint error: Computed values are not permitted in an enum with string valued members.
const dynamic_draw = DYNAMIC_DRAW;
const static_draw = STATIC_DRAW;
const stream_draw = STREAM_DRAW;

/**
 * @enum {number}
 */
enum BufferUsage {
	STATIC_DRAW = static_draw,
	STREAM_DRAW = stream_draw,
	DYNAMIC_DRAW = dynamic_draw
}

/**
 * @constructor
 * @param {Array.<number>=} opt_arr Array.
 * @param {number=} opt_usage Usage.
 * @struct
 */
export default class WebGLBuffer {
	private arr_: number[];
	private usage_: number;
	constructor(opt_arr?: number[], opt_usage?: number) {

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.arr_ = opt_arr !== undefined ? opt_arr : [];

		/**
		 * @private
		 * @type {number}
		 */
		this.usage_ = opt_usage !== undefined ? opt_usage : BufferUsage.STATIC_DRAW;
	}


	/**
	 * @return {Array.<number>} Array.
	 */
	public getArray() {
		return this.arr_;
	}


	/**
	 * @return {number} Usage.
	 */
	public getUsage() {
		return this.usage_;
	}
}
