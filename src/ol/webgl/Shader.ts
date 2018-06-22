/**
 * @module ol/webgl/Shader
 */
import { FALSE } from '../functions';

/**
 * @constructor
 * @abstract
 * @param {string} source Source.
 * @struct
 */
export default class WebGLShader {
	/**
	 * @return {boolean} Is animated?
	 */
	public isAnimated = FALSE;
	private source: string;
	constructor(source: string) {
		this.source = source;
	}
	/**
	 * @abstract
	 * @return {number} Type.
	 */
	public getType() { }


	/**
	 * @return {string} Source.
	 */
	public getSource() {
		return this.source;
	}
}
