/**
 * @module ol/webgl/Vertex
 */
import {inherits} from '../index';
import {VERTEX_SHADER} from '../webgl';
import WebGLShader from '../webgl/Shader';

/**
 * @constructor
 * @extends {module:ol/webgl/Shader}
 * @param {string} source Source.
 * @struct
 */
const WebGLVertex = function(source) {
  WebGLShader.call(this, source);
};

inherits(WebGLVertex, WebGLShader);


/**
 * @inheritDoc
 */
WebGLVertex.prototype.getType = function() {
  return VERTEX_SHADER;
};
export default WebGLVertex;
