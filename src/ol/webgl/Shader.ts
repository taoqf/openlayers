/**
 * @module ol/webgl/Shader
 */

/**
 * @constructor
 * @abstract
 * @param {string} source Source.
 * @struct
 */
export default abstract class WebGLShader {
	private source: string;
	constructor(source: string) {
		this.source = source;
	}
	/**
	 * @abstract
	 * @return {number} Type.
	 */
	public abstract getType(): number;
	/**
	 * @return {boolean} Is animated?
	 */
	public isAnimated() {
		return false;
	}
	/**
	 * @return {string} Source.
	 */
	public getSource() {
		return this.source;
	}
}
