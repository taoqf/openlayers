/**
 * @module ol/renderer/webgl/tilelayershader/Locations
 */
// This file is automatically generated, do not edit
// Run `make shaders` to generate, and commit the result.

import {DEBUG_WEBGL} from '../../../index';

/**
 * @constructor
 * @param {WebGLRenderingContext} gl GL.
 * @param {WebGLProgram} program Program.
 * @struct
 */
const Locations = function(gl, program) {

  /**
   * @type {WebGLUniformLocation}
   */
  this.u_tileOffset = gl.getUniformLocation(
    program, DEBUG_WEBGL ? 'u_tileOffset' : 'd');

  /**
   * @type {WebGLUniformLocation}
   */
  this.u_texture = gl.getUniformLocation(
    program, DEBUG_WEBGL ? 'u_texture' : 'e');

  /**
   * @type {number}
   */
  this.a_position = gl.getAttribLocation(
    program, DEBUG_WEBGL ? 'a_position' : 'b');

  /**
   * @type {number}
   */
  this.a_texCoord = gl.getAttribLocation(
    program, DEBUG_WEBGL ? 'a_texCoord' : 'c');
};

export default Locations;