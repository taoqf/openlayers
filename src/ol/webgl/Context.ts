/**
 * @module ol/webgl/Context
 */
import { includes } from '../array';
import Disposable from '../Disposable';
import { listen, unlistenAll } from '../events';
import { getUid, WEBGL_EXTENSIONS } from '../index';
import { clear } from '../obj';
import { ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, TEXTURE_2D, TEXTURE_WRAP_S, TEXTURE_WRAP_T } from '../webgl';
import ContextEventType from '../webgl/ContextEventType';
import Buffer from './Buffer';
import WebGLFragment from './Fragment';
import Shader from './Shader';
import WebGLVertex from './Vertex';


/**
 * @typedef {Object} BufferCacheEntry
 * @property {module:ol/webgl/Buffer} buf
 * @property {WebGLBuffer} buffer
 */

export interface BufferCacheEntry {
	buf: Buffer;
	buffer: WebGLBuffer;
}

/**
 * @classdesc
 * A WebGL context for accessing low-level WebGL capabilities.
 *
 * @constructor
 * @extends {module:ol/Disposable}
 * @param {HTMLCanvasElement} canvas Canvas.
 * @param {WebGLRenderingContext} gl GL.
 */
export default class WebGLContext extends Disposable {
	private canvas_: HTMLCanvasElement;
	private gl_: WebGLRenderingContext;
	private bufferCache_: { [key: string]: BufferCacheEntry; };
	private shaderCache_: { [key: string]: WebGLShader; };
	private programCache_: { [key: string]: WebGLProgram; };
	private currentProgram_: WebGLProgram | null;
	private hitDetectionFramebuffer_: WebGLFramebuffer | null;
	private hitDetectionTexture_: WebGLTexture | null;
	private hitDetectionRenderbuffer_: WebGLRenderbuffer | null;
	private hasOESElementIndexUint: boolean;
	constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
		super();
		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas_ = canvas;

		/**
		 * @private
		 * @type {WebGLRenderingContext}
		 */
		this.gl_ = gl;

		/**
		 * @private
		 * @type {!Object.<string, module:ol/webgl/Context~BufferCacheEntry>}
		 */
		this.bufferCache_ = {};

		/**
		 * @private
		 * @type {!Object.<string, WebGLShader>}
		 */
		this.shaderCache_ = {};

		/**
		 * @private
		 * @type {!Object.<string, WebGLProgram>}
		 */
		this.programCache_ = {};

		/**
		 * @private
		 * @type {WebGLProgram}
		 */
		this.currentProgram_ = null;

		/**
		 * @private
		 * @type {WebGLFramebuffer}
		 */
		this.hitDetectionFramebuffer_ = null;

		/**
		 * @private
		 * @type {WebGLTexture}
		 */
		this.hitDetectionTexture_ = null;

		/**
		 * @private
		 * @type {WebGLRenderbuffer}
		 */
		this.hitDetectionRenderbuffer_ = null;

		/**
		 * @type {boolean}
		 */
		this.hasOESElementIndexUint = includes(WEBGL_EXTENSIONS, 'OES_element_index_uint');

		// use the OES_element_index_uint extension if available
		if (this.hasOESElementIndexUint) {
			gl.getExtension('OES_element_index_uint');
		}

		listen(this.canvas_, ContextEventType.LOST,
			this.handleWebGLContextLost, this);
		listen(this.canvas_, ContextEventType.RESTORED,
			this.handleWebGLContextRestored, this);

	}

	/**
	 * Just bind the buffer if it's in the cache. Otherwise create
	 * the WebGL buffer, bind it, populate it, and add an entry to
	 * the cache.
	 * @param {number} target Target.
	 * @param {module:ol/webgl/Buffer} buf Buffer.
	 */
	public bindBuffer(target: number, buf: Buffer) {
		const gl = this.getGL();
		const arr = buf.getArray();
		const bufferKey = String(getUid(buf));
		if (bufferKey in this.bufferCache_) {
			const bufferCacheEntry = this.bufferCache_[bufferKey];
			gl.bindBuffer(target, bufferCacheEntry.buffer);
		} else {
			const buffer = gl.createBuffer()!;
			gl.bindBuffer(target, buffer);
			let /** @type {ArrayBufferView} */ arrayBuffer: Float32Array | Uint32Array | Uint16Array;
			if (target === ARRAY_BUFFER) {
				arrayBuffer = new Float32Array(arr);
			} else if (target === ELEMENT_ARRAY_BUFFER) {
				arrayBuffer = this.hasOESElementIndexUint ?
					new Uint32Array(arr) : new Uint16Array(arr);
			}
			gl.bufferData(target, arrayBuffer!, buf.getUsage());
			this.bufferCache_[bufferKey] = {
				buf,
				buffer
			};
		}
	}


	/**
	 * @param {module:ol/webgl/Buffer} buf Buffer.
	 */
	public deleteBuffer(buf: Buffer) {
		const gl = this.getGL();
		const bufferKey = String(getUid(buf));
		const bufferCacheEntry = this.bufferCache_[bufferKey];
		if (!gl.isContextLost()) {
			gl.deleteBuffer(bufferCacheEntry.buffer);
		}
		delete this.bufferCache_[bufferKey];
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		unlistenAll(this.canvas_);
		const gl = this.getGL();
		if (!gl.isContextLost()) {
			Object.keys(this.bufferCache_).forEach((key) => {
				gl.deleteBuffer(this.bufferCache_[key].buffer);
			});
			Object.keys(this.programCache_).forEach((key) => {
				gl.deleteProgram(this.programCache_[key]);
			});
			Object.keys(this.shaderCache_).forEach((key) => {
				gl.deleteShader(this.shaderCache_[key]);
			});
			// delete objects for hit-detection
			gl.deleteFramebuffer(this.hitDetectionFramebuffer_);
			gl.deleteRenderbuffer(this.hitDetectionRenderbuffer_);
			gl.deleteTexture(this.hitDetectionTexture_);
		}
	}


	/**
	 * @return {HTMLCanvasElement} Canvas.
	 */
	public getCanvas() {
		return this.canvas_;
	}


	/**
	 * Get the WebGL rendering context
	 * @return {WebGLRenderingContext} The rendering context.
	 * @api
	 */
	public getGL() {
		return this.gl_;
	}


	/**
	 * Get the frame buffer for hit detection.
	 * @return {WebGLFramebuffer} The hit detection frame buffer.
	 */
	public getHitDetectionFramebuffer() {
		if (!this.hitDetectionFramebuffer_) {
			this.initHitDetectionFramebuffer_();
		}
		return this.hitDetectionFramebuffer_;
	}


	/**
	 * Get shader from the cache if it's in the cache. Otherwise, create
	 * the WebGL shader, compile it, and add entry to cache.
	 * @param {module:ol/webgl/Shader} shaderObject Shader object.
	 * @return {WebGLShader} Shader.
	 */
	public getShader(shaderObject: Shader) {
		const shaderKey = String(getUid(shaderObject));
		if (shaderKey in this.shaderCache_) {
			return this.shaderCache_[shaderKey];
		} else {
			const gl = this.getGL();
			const shader = gl.createShader(shaderObject.getType())!;
			gl.shaderSource(shader, shaderObject.getSource());
			gl.compileShader(shader);
			this.shaderCache_[shaderKey] = shader;
			return shader;
		}
	}


	/**
	 * Get the program from the cache if it's in the cache. Otherwise create
	 * the WebGL program, attach the shaders to it, and add an entry to the
	 * cache.
	 * @param {module:ol/webgl/Fragment} fragmentShaderObject Fragment shader.
	 * @param {module:ol/webgl/Vertex} vertexShaderObject Vertex shader.
	 * @return {WebGLProgram} Program.
	 */
	public getProgram(fragmentShaderObject: WebGLFragment, vertexShaderObject: WebGLVertex) {
		const programKey = getUid(fragmentShaderObject) + '/' + getUid(vertexShaderObject);
		if (programKey in this.programCache_) {
			return this.programCache_[programKey];
		} else {
			const gl = this.getGL();
			const program = gl.createProgram()!;
			gl.attachShader(program, this.getShader(fragmentShaderObject));
			gl.attachShader(program, this.getShader(vertexShaderObject));
			gl.linkProgram(program);
			this.programCache_[programKey] = program;
			return program;
		}
	}


	/**
	 * FIXME empty description for jsdoc
	 */
	public handleWebGLContextLost() {
		clear(this.bufferCache_);
		clear(this.shaderCache_);
		clear(this.programCache_);
		this.currentProgram_ = null;
		this.hitDetectionFramebuffer_ = null;
		this.hitDetectionTexture_ = null;
		this.hitDetectionRenderbuffer_ = null;
	}


	/**
	 * FIXME empty description for jsdoc
	 */
	public handleWebGLContextRestored() {
	}

	/**
	 * Use a program.  If the program is already in use, this will return `false`.
	 * @param {WebGLProgram} program Program.
	 * @return {boolean} Changed.
	 * @api
	 */
	public useProgram(program: WebGLProgram) {
		if (program === this.currentProgram_) {
			return false;
		} else {
			const gl = this.getGL();
			gl.useProgram(program);
			this.currentProgram_ = program;
			return true;
		}
	}

	/**
	 * Creates a 1x1 pixel framebuffer for the hit-detection.
	 * @private
	 */
	private initHitDetectionFramebuffer_() {
		const gl = this.gl_;
		const framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

		const texture = createEmptyTexture(gl, 1, 1);
		const renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 1, 1);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
			gl.RENDERBUFFER, renderbuffer);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		this.hitDetectionFramebuffer_ = framebuffer;
		this.hitDetectionTexture_ = texture;
		this.hitDetectionRenderbuffer_ = renderbuffer;
	}
}

/**
 * @param {WebGLRenderingContext} gl WebGL rendering context.
 * @param {number=} opt_wrapS wrapS.
 * @param {number=} opt_wrapT wrapT.
 * @return {WebGLTexture} The texture.
 */
function createTextureInternal(gl: WebGLRenderingContext, opt_wrapS?: number, opt_wrapT?: number) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

	if (opt_wrapS !== undefined) {
		gl.texParameteri(
			TEXTURE_2D, TEXTURE_WRAP_S, opt_wrapS);
	}
	if (opt_wrapT !== undefined) {
		gl.texParameteri(
			TEXTURE_2D, TEXTURE_WRAP_T, opt_wrapT);
	}

	return texture;
}


/**
 * @param {WebGLRenderingContext} gl WebGL rendering context.
 * @param {number} width Width.
 * @param {number} height Height.
 * @param {number=} opt_wrapS wrapS.
 * @param {number=} opt_wrapT wrapT.
 * @return {WebGLTexture} The texture.
 */
export function createEmptyTexture(gl: WebGLRenderingContext, width: number, height: number, opt_wrapS?: number, opt_wrapT?: number) {
	const texture = createTextureInternal(gl, opt_wrapS, opt_wrapT);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	return texture;
}


/**
 * @param {WebGLRenderingContext} gl WebGL rendering context.
 * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement} image Image.
 * @param {number=} opt_wrapS wrapS.
 * @param {number=} opt_wrapT wrapT.
 * @return {WebGLTexture} The texture.
 */
export function createTexture(gl: WebGLRenderingContext, image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement, opt_wrapS?: number, opt_wrapT?: number) {
	const texture = createTextureInternal(gl, opt_wrapS, opt_wrapT);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	return texture;
}
