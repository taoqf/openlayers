/**
 * @module ol/render/webgl/Replay
 */
import { Coordinate } from '../../coordinate';
import { Extent, getCenter } from '../../extent';
import Feature from '../../Feature';
import { Size } from '../../size';
import {
	create as createTransform,
	reset as resetTransform,
	rotate as rotateTransform,
	scale as scaleTransform,
	Transform,
	translate as translateTransform
} from '../../transform';
import { create, fromTransform } from '../../vec/mat4';
import {
	ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, TRIANGLES,
	UNSIGNED_INT, UNSIGNED_SHORT
} from '../../webgl';
import WebGLBuffer from '../../webgl/Buffer';
import WebGLContext from '../../webgl/Context';
import RenderFeature from '../Feature';
import VectorContext from '../VectorContext';
import CirclereplayLocations from './circlereplay/defaultshader/Locations';
import WebGLLineStringReplay from './LineStringReplay';
import LinestringreplayLocations from './linestringreplay/defaultshader/Locations';
import PolygonreplayreplayLocations from './polygonreplay/defaultshader/Locations';
import TexturereplayreplayLocations from './texturereplay/defaultshader/Locations';

/**
 * @constructor
 * @abstract
 * @extends {module:ol/render/VectorContext}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @struct
 */
export default abstract class WebGLReplay extends VectorContext {
	protected tolerance: number;
	protected maxExtent: Extent;
	protected origin: Coordinate;
	protected indices: number[];
	protected indicesBuffer: WebGLBuffer;
	protected startIndices: number[];
	protected startIndicesFeature: Array<Feature | RenderFeature>;
	protected vertices: number[];
	protected verticesBuffer: WebGLBuffer;
	protected lineStringReplay: WebGLLineStringReplay | undefined;
	private projectionMatrix_: Transform;
	private offsetRotateMatrix_: Transform;
	private offsetScaleMatrix_: Transform;
	private tmpMat4_: number[];
	constructor(tolerance: number, maxExtent: Extent) {
		super();

		/**
		 * @protected
		 * @type {number}
		 */
		this.tolerance = tolerance;

		/**
		 * @protected
		 * @const
		 * @type {module:ol/extent~Extent}
		 */
		this.maxExtent = maxExtent;

		/**
		 * The origin of the coordinate system for the point coordinates sent to
		 * the GPU. To eliminate jitter caused by precision problems in the GPU
		 * we use the "Rendering Relative to Eye" technique described in the "3D
		 * Engine Design for Virtual Globes" book.
		 * @protected
		 * @type {module:ol/coordinate~Coordinate}
		 */
		this.origin = getCenter(maxExtent);

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.projectionMatrix_ = createTransform();

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.offsetRotateMatrix_ = createTransform();

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.offsetScaleMatrix_ = createTransform();

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.tmpMat4_ = create();

		/**
		 * @protected
		 * @type {Array.<number>}
		 */
		this.indices = [];

		/**
		 * @protected
		 * @type {?module:ol/webgl/Buffer}
		 */
		this.indicesBuffer = null;

		/**
		 * Start index per feature (the index).
		 * @protected
		 * @type {Array.<number>}
		 */
		this.startIndices = [];

		/**
		 * Start index per feature (the feature).
		 * @protected
		 * @type {Array.<module:ol/Feature|module:ol/render/Feature>}
		 */
		this.startIndicesFeature = [];

		/**
		 * @protected
		 * @type {Array.<number>}
		 */
		this.vertices = [];

		/**
		 * @protected
		 * @type {?module:ol/webgl/Buffer}
		 */
		this.verticesBuffer = null;

		/**
		 * Optional parameter for PolygonReplay instances.
		 * @protected
		 * @type {module:ol/render/webgl/LineStringReplay|undefined}
		 */
		this.lineStringReplay = undefined;
	}


	/**
	 * @abstract
	 * @param {module:ol/webgl/Context} context WebGL context.
	 * @return {function()} Delete resources function.
	 */
	public abstract getDeleteResourcesFunction(context: WebGLContext): () => any;


	/**
	 * @abstract
	 * @param {module:ol/webgl/Context} context Context.
	 */
	public abstract finish(context: WebGLContext): void;

	/**
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {module:ol/coordinate~Coordinate} center Center.
	 * @param {number} resolution Resolution.
	 * @param {number} rotation Rotation.
	 * @param {module:ol/size~Size} size Size.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {number} opacity Global opacity.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T|undefined} featureCallback Feature callback.
	 * @param {boolean} oneByOne Draw features one-by-one for the hit-detecion.
	 * @param {module:ol/extent~Extent=} opt_hitExtent Hit extent: Only features intersecting
	 *  this extent are checked.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	public replay<T>(context: WebGLContext, center: Coordinate, resolution: number, rotation: number, size: Size, pixelRatio: number, opacity: number, skippedFeaturesHash: { [feature: string]: boolean; }, featureCallback: (module: Feature | RenderFeature) => T | undefined, oneByOne: boolean, opt_hitExtent?: Extent) {
		const gl = context.getGL();
		let tmpStencil: boolean;
		let tmpStencilFunc: number;
		let tmpStencilMaskVal: number;
		let tmpStencilRef: number;
		let tmpStencilMask: number;
		let tmpStencilOpFail: number;
		let tmpStencilOpPass: number;
		let tmpStencilOpZFail: number;

		if (this.lineStringReplay) {
			tmpStencil = gl.isEnabled(gl.STENCIL_TEST);
			tmpStencilFunc = gl.getParameter(gl.STENCIL_FUNC);
			tmpStencilMaskVal = gl.getParameter(gl.STENCIL_VALUE_MASK);
			tmpStencilRef = gl.getParameter(gl.STENCIL_REF);
			tmpStencilMask = gl.getParameter(gl.STENCIL_WRITEMASK);
			tmpStencilOpFail = gl.getParameter(gl.STENCIL_FAIL);
			tmpStencilOpPass = gl.getParameter(gl.STENCIL_PASS_DEPTH_PASS);
			tmpStencilOpZFail = gl.getParameter(gl.STENCIL_PASS_DEPTH_FAIL);

			gl.enable(gl.STENCIL_TEST);
			gl.clear(gl.STENCIL_BUFFER_BIT);
			gl.stencilMask(255);
			gl.stencilFunc(gl.ALWAYS, 1, 255);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

			this.lineStringReplay.replay(context,
				center, resolution, rotation, size, pixelRatio,
				opacity, skippedFeaturesHash,
				featureCallback, oneByOne, opt_hitExtent);

			gl.stencilMask(0);
			gl.stencilFunc(gl.NOTEQUAL, 1, 255);
		}

		context.bindBuffer(ARRAY_BUFFER, this.verticesBuffer);

		context.bindBuffer(ELEMENT_ARRAY_BUFFER, this.indicesBuffer);

		const locations = this.setUpProgram(gl, context, size, pixelRatio);

		// set the "uniform" values
		const projectionMatrix = resetTransform(this.projectionMatrix_);
		scaleTransform(projectionMatrix, 2 / (resolution * size[0]), 2 / (resolution * size[1]));
		rotateTransform(projectionMatrix, -rotation);
		translateTransform(projectionMatrix, -(center[0] - this.origin[0]), -(center[1] - this.origin[1]));

		const offsetScaleMatrix = resetTransform(this.offsetScaleMatrix_);
		scaleTransform(offsetScaleMatrix, 2 / size[0], 2 / size[1]);

		const offsetRotateMatrix = resetTransform(this.offsetRotateMatrix_);
		if (rotation !== 0) {
			rotateTransform(offsetRotateMatrix, -rotation);
		}

		gl.uniformMatrix4fv(locations.u_projectionMatrix, false,
			fromTransform(this.tmpMat4_, projectionMatrix));
		gl.uniformMatrix4fv(locations.u_offsetScaleMatrix, false,
			fromTransform(this.tmpMat4_, offsetScaleMatrix));
		gl.uniformMatrix4fv(locations.u_offsetRotateMatrix, false,
			fromTransform(this.tmpMat4_, offsetRotateMatrix));
		gl.uniform1f(locations.u_opacity, opacity);

		// draw!
		let result;
		if (featureCallback === undefined) {
			this.drawReplay(gl, context, skippedFeaturesHash, false);
		} else {
			// draw feature by feature for the hit-detection
			result = this.drawHitDetectionReplay(gl, context, skippedFeaturesHash,
				featureCallback, oneByOne, opt_hitExtent);
		}

		// disable the vertex attrib arrays
		this.shutDownProgram(gl, locations);

		if (this.lineStringReplay) {
			if (!tmpStencil) {
				gl.disable(gl.STENCIL_TEST);
			}
			gl.clear(gl.STENCIL_BUFFER_BIT);
			gl.stencilFunc(tmpStencilFunc, tmpStencilRef, tmpStencilMaskVal);
			gl.stencilMask(tmpStencilMask);
			gl.stencilOp(tmpStencilOpFail, tmpStencilOpZFail, tmpStencilOpPass);
		}

		return result;
	}

	/**
	 * @abstract
	 * @protected
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {module:ol/size~Size} size Size.
	 * @param {number} pixelRatio Pixel ratio.
	 */
	protected abstract setUpProgram(gl: WebGLRenderingContext, context: WebGLContext, size: Size, pixelRatio: number): CirclereplayLocations | LinestringreplayLocations | PolygonreplayreplayLocations | TexturereplayreplayLocations;

	/**
	 * @abstract
	 * @protected
	 * @param gl gl.
	 */
	protected abstract shutDownProgram(gl: WebGLRenderingContext, locations: CirclereplayLocations | LinestringreplayLocations | PolygonreplayreplayLocations | TexturereplayreplayLocations): void;

	/**
	 * @abstract
	 * @protected
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {boolean} hitDetection Hit detection mode.
	 */
	protected abstract drawReplay(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, hitDetection: boolean): void;

	/**
	 * @abstract
	 * @protected
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T|undefined} featureCallback Feature callback.
	 * @param {module:ol/extent~Extent=} opt_hitExtent Hit extent: Only features intersecting this extent are checked.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	protected abstract drawHitDetectionReplayOneByOne<T>(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, featureCallback: (module: Feature | RenderFeature) => T | undefined, opt_hitExtent?: Extent): T;

	/**
	 * @protected
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T|undefined} featureCallback Feature callback.
	 * @param {boolean} oneByOne Draw features one-by-one for the hit-detecion.
	 * @param {module:ol/extent~Extent=} opt_hitExtent Hit extent: Only features intersecting
	 *  this extent are checked.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	protected drawHitDetectionReplay<T>(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, featureCallback: (module: Feature | RenderFeature) => T | undefined, oneByOne: boolean, opt_hitExtent?: Extent) {
		if (!oneByOne) {
			// draw all hit-detection features in "once" (by texture group)
			return this.drawHitDetectionReplayAll(gl, context,
				skippedFeaturesHash, featureCallback);
		} else {
			// draw hit-detection features one by one
			return this.drawHitDetectionReplayOneByOne(gl, context,
				skippedFeaturesHash, featureCallback, opt_hitExtent);
		}
	}


	/**
	 * @protected
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features to skip.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T|undefined} featureCallback Feature callback.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	protected drawHitDetectionReplayAll<T>(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, featureCallback: (module: Feature | RenderFeature) => T | undefined) {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		this.drawReplay(gl, context, skippedFeaturesHash, true);

		const result = featureCallback(null);
		if (result) {
			return result;
		} else {
			return undefined;
		}
	}

	/**
	 * @protected
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {number} start Start index.
	 * @param {number} end End index.
	 */
	protected drawElements(gl: WebGLRenderingContext, context: WebGLContext, start: number, end: number) {
		const elementType = context.hasOESElementIndexUint ?
			UNSIGNED_INT : UNSIGNED_SHORT;
		const elementSize = context.hasOESElementIndexUint ? 4 : 2;

		const numItems = end - start;
		const offsetInBytes = start * elementSize;
		gl.drawElements(TRIANGLES, numItems, elementType, offsetInBytes);
	}
}
