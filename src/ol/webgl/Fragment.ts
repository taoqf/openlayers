/**
 * @module ol/webgl/Fragment
 */
import { FRAGMENT_SHADER } from '../webgl';
import WebGLShader from '../webgl/Shader';

/**
 * @constructor
 * @extends {module:ol/webgl/Shader}
 * @param {string} source Source.
 * @struct
 */
export default class WebGLFragment extends WebGLShader {
	/**
	 * @inheritDoc
	 */
	public getType() {
		return FRAGMENT_SHADER;
	}
}
