/**
 * @module ol/webgl/Vertex
 */
import { VERTEX_SHADER } from '../webgl';
import WebGLShader from '../webgl/Shader';

/**
 * @constructor
 * @extends {module:ol/webgl/Shader}
 * @param {string} source Source.
 * @struct
 */
export default class WebGLVertex extends WebGLShader {
	/**
	 * @inheritDoc
	 */
	public getType() {
		return VERTEX_SHADER;
	}
}
