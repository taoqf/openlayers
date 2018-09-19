/**
 * @module ol/render/webgl/TextureReplay
 */
import { Extent, intersects } from '../../extent';
import Feature from '../../Feature';
import { getUid } from '../../index';
import { isEmpty } from '../../obj';
import { Size } from '../../size';
import { CLAMP_TO_EDGE, FLOAT, TEXTURE_2D } from '../../webgl';
import WebGLContext, { createTexture } from '../../webgl/Context';
import RenderFeature from '../Feature';
import WebGLReplay from '../webgl/Replay';
import { fragment, vertex } from '../webgl/texturereplay/defaultshader';
import Locations from '../webgl/texturereplay/defaultshader/Locations';

/**
 * @constructor
 * @abstract
 * @extends {module:ol/render/webgl/Replay}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @struct
 */
export default abstract class WebGLTextureReplay extends WebGLReplay {
	protected anchorX: number | undefined;
	protected anchorY: number | undefined;
	protected groupIndices: number[];
	protected hitDetectionGroupIndices: number[];
	protected height: number | undefined;
	protected imageHeight: number | undefined;
	protected imageWidth: number | undefined;
	protected defaultLocations: Locations;
	protected opacity: number | undefined;
	protected originX: number | undefined;
	protected originY: number | undefined;
	protected rotateWithView: boolean | undefined;
	protected rotation: number | undefined;
	protected scale: number | undefined;
	protected width: number | undefined;
	constructor(tolerance: number, maxExtent: Extent) {
		super(tolerance, maxExtent);

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.anchorX = undefined;

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.anchorY = undefined;

		/**
		 * @type {Array.<number>}
		 * @protected
		 */
		this.groupIndices = [];

		/**
		 * @type {Array.<number>}
		 * @protected
		 */
		this.hitDetectionGroupIndices = [];

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.height = undefined;

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.imageHeight = undefined;

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.imageWidth = undefined;

		/**
		 * @protected
		 * @type {module:ol/render/webgl/texturereplay/defaultshader/Locations}
		 */
		this.defaultLocations = null;

		/**
		 * @protected
		 * @type {number|undefined}
		 */
		this.opacity = undefined;

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.originX = undefined;

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.originY = undefined;

		/**
		 * @protected
		 * @type {boolean|undefined}
		 */
		this.rotateWithView = undefined;

		/**
		 * @protected
		 * @type {number|undefined}
		 */
		this.rotation = undefined;

		/**
		 * @protected
		 * @type {number|undefined}
		 */
		this.scale = undefined;

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.width = undefined;
	}

	public finish(_context: WebGLContext) {
		this.anchorX = undefined;
		this.anchorY = undefined;
		this.height = undefined;
		this.imageHeight = undefined;
		this.imageWidth = undefined;
		this.indices = null;
		this.opacity = undefined;
		this.originX = undefined;
		this.originY = undefined;
		this.rotateWithView = undefined;
		this.rotation = undefined;
		this.scale = undefined;
		this.vertices = null;
		this.width = undefined;
	}

	public getDeleteResourcesFunction(context: WebGLContext) {
		const verticesBuffer = this.verticesBuffer;
		const indicesBuffer = this.indicesBuffer;
		const textures = this.getTextures(true);
		const gl = context.getGL();
		return () => {
			if (!gl.isContextLost()) {
				for (let i = 0, ii = textures.length; i < ii; ++i) {
					gl.deleteTexture(textures[i]);
				}
			}
			context.deleteBuffer(verticesBuffer);
			context.deleteBuffer(indicesBuffer);
		};
	}

	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 * @return {number} My end.
	 * @protected
	 */
	protected drawCoordinates(flatCoordinates: number[], offset: number, end: number, stride: number) {
		const anchorX = /** @type {number} */ (this.anchorX);
		const anchorY = /** @type {number} */ (this.anchorY);
		const height = /** @type {number} */ (this.height);
		const imageHeight = /** @type {number} */ (this.imageHeight);
		const imageWidth = /** @type {number} */ (this.imageWidth);
		const opacity = /** @type {number} */ (this.opacity);
		const originX = /** @type {number} */ (this.originX);
		const originY = /** @type {number} */ (this.originY);
		const rotateWithView = this.rotateWithView ? 1.0 : 0.0;
		// this.rotation_ is anti-clockwise, but rotation is clockwise
		const rotation = /** @type {number} */ (-this.rotation);
		const scale = /** @type {number} */ (this.scale);
		const width = /** @type {number} */ (this.width);
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);
		let numIndices = this.indices.length;
		let numVertices = this.vertices.length;
		// let n, offsetX, offsetY, x, y;
		for (let i = offset; i < end; i += stride) {
			const x = flatCoordinates[i] - this.origin[0];
			const y = flatCoordinates[i + 1] - this.origin[1];

			// There are 4 vertices per [x, y] point, one for each corner of the
			// rectangle we're going to draw. We'd use 1 vertex per [x, y] point if
			// WebGL supported Geometry Shaders (which can emit new vertices), but that
			// is not currently the case.
			//
			// And each vertex includes 8 values: the x and y coordinates, the x and
			// y offsets used to calculate the position of the corner, the u and
			// v texture coordinates for the corner, the opacity, and whether the
			// the image should be rotated with the view (rotateWithView).

			const n = numVertices / 8;

			// bottom-left corner
			let offsetX = -scale * anchorX;
			let offsetY = -scale * (height - anchorY);
			this.vertices[numVertices++] = x;
			this.vertices[numVertices++] = y;
			this.vertices[numVertices++] = offsetX * cos - offsetY * sin;
			this.vertices[numVertices++] = offsetX * sin + offsetY * cos;
			this.vertices[numVertices++] = originX / imageWidth;
			this.vertices[numVertices++] = (originY + height) / imageHeight;
			this.vertices[numVertices++] = opacity;
			this.vertices[numVertices++] = rotateWithView;

			// bottom-right corner
			offsetX = scale * (width - anchorX);
			offsetY = -scale * (height - anchorY);
			this.vertices[numVertices++] = x;
			this.vertices[numVertices++] = y;
			this.vertices[numVertices++] = offsetX * cos - offsetY * sin;
			this.vertices[numVertices++] = offsetX * sin + offsetY * cos;
			this.vertices[numVertices++] = (originX + width) / imageWidth;
			this.vertices[numVertices++] = (originY + height) / imageHeight;
			this.vertices[numVertices++] = opacity;
			this.vertices[numVertices++] = rotateWithView;

			// top-right corner
			offsetX = scale * (width - anchorX);
			offsetY = scale * anchorY;
			this.vertices[numVertices++] = x;
			this.vertices[numVertices++] = y;
			this.vertices[numVertices++] = offsetX * cos - offsetY * sin;
			this.vertices[numVertices++] = offsetX * sin + offsetY * cos;
			this.vertices[numVertices++] = (originX + width) / imageWidth;
			this.vertices[numVertices++] = originY / imageHeight;
			this.vertices[numVertices++] = opacity;
			this.vertices[numVertices++] = rotateWithView;

			// top-left corner
			offsetX = -scale * anchorX;
			offsetY = scale * anchorY;
			this.vertices[numVertices++] = x;
			this.vertices[numVertices++] = y;
			this.vertices[numVertices++] = offsetX * cos - offsetY * sin;
			this.vertices[numVertices++] = offsetX * sin + offsetY * cos;
			this.vertices[numVertices++] = originX / imageWidth;
			this.vertices[numVertices++] = originY / imageHeight;
			this.vertices[numVertices++] = opacity;
			this.vertices[numVertices++] = rotateWithView;

			this.indices[numIndices++] = n;
			this.indices[numIndices++] = n + 1;
			this.indices[numIndices++] = n + 2;
			this.indices[numIndices++] = n;
			this.indices[numIndices++] = n + 2;
			this.indices[numIndices++] = n + 3;
		}

		return numVertices;
	}


	/**
	 * @protected
	 * @param {Array.<WebGLTexture>} textures Textures.
	 * @param {Array.<HTMLCanvasElement|HTMLImageElement|HTMLVideoElement>} images Images.
	 * @param {!Object.<string, WebGLTexture>} texturePerImage Texture cache.
	 * @param {WebGLRenderingContext} gl Gl.
	 */
	protected createTextures(textures: WebGLTexture[], images: Array<HTMLCanvasElement | HTMLImageElement | HTMLVideoElement>, texturePerImage: { [t: string]: WebGLTexture }, gl: WebGLRenderingContext) {
		let texture;
		const ii = images.length;
		for (let i = 0; i < ii; ++i) {
			const image = images[i];

			const uid = getUid(image).toString();
			if (uid in texturePerImage) {
				texture = texturePerImage[uid];
			} else {
				texture = createTexture(
					gl, image, CLAMP_TO_EDGE, CLAMP_TO_EDGE);
				texturePerImage[uid] = texture;
			}
			textures[i] = texture;
		}
	}


	protected setUpProgram(gl: WebGLRenderingContext, context: WebGLContext, _size: Size, _pixelRatio: number) {
		// get the program
		const program = context.getProgram(fragment, vertex);

		// get the locations
		let locations;
		if (!this.defaultLocations) {
			locations = new Locations(gl, program);
			this.defaultLocations = locations;
		} else {
			locations = this.defaultLocations;
		}

		// use the program (FIXME: use the return value)
		context.useProgram(program);

		// enable the vertex attrib arrays
		gl.enableVertexAttribArray(locations.a_position);
		gl.vertexAttribPointer(locations.a_position, 2, FLOAT,
			false, 32, 0);

		gl.enableVertexAttribArray(locations.a_offsets);
		gl.vertexAttribPointer(locations.a_offsets, 2, FLOAT,
			false, 32, 8);

		gl.enableVertexAttribArray(locations.a_texCoord);
		gl.vertexAttribPointer(locations.a_texCoord, 2, FLOAT,
			false, 32, 16);

		gl.enableVertexAttribArray(locations.a_opacity);
		gl.vertexAttribPointer(locations.a_opacity, 1, FLOAT,
			false, 32, 24);

		gl.enableVertexAttribArray(locations.a_rotateWithView);
		gl.vertexAttribPointer(locations.a_rotateWithView, 1, FLOAT,
			false, 32, 28);

		return locations;
	}

	protected shutDownProgram(gl: WebGLRenderingContext, locations: Locations) {
		gl.disableVertexAttribArray(locations.a_position);
		gl.disableVertexAttribArray(locations.a_offsets);
		gl.disableVertexAttribArray(locations.a_texCoord);
		gl.disableVertexAttribArray(locations.a_opacity);
		gl.disableVertexAttribArray(locations.a_rotateWithView);
	}

	protected drawReplay(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, hitDetection: boolean) {
		const textures = hitDetection ? this.getHitDetectionTextures() : this.getTextures();
		const groupIndices = hitDetection ? this.hitDetectionGroupIndices : this.groupIndices;

		if (!isEmpty(skippedFeaturesHash)) {
			this.drawReplaySkipping(gl, context, skippedFeaturesHash, textures, groupIndices);
		} else {
			for (let i = 0, ii = textures.length, start = 0; i < ii; ++i) {
				gl.bindTexture(TEXTURE_2D, textures[i]);
				const end = groupIndices[i];
				this.drawElements(gl, context, start, end);
				start = end;
			}
		}
	}


	/**
	 * Draw the replay while paying attention to skipped features.
	 *
	 * This functions creates groups of features that can be drawn to together,
	 * so that the number of `drawElements` calls is minimized.
	 *
	 * For example given the following texture groups:
	 *
	 *    Group 1: A B C
	 *    Group 2: D [E] F G
	 *
	 * If feature E should be skipped, the following `drawElements` calls will be
	 * made:
	 *
	 *    drawElements with feature A, B and C
	 *    drawElements with feature D
	 *    drawElements with feature F and G
	 *
	 * @protected
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {Object.<string, boolean>} skippedFeaturesHash Ids of features
	 *  to skip.
	 * @param {Array.<WebGLTexture>} textures Textures.
	 * @param {Array.<number>} groupIndices Texture group indices.
	 */
	protected drawReplaySkipping(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, textures: WebGLTexture[], groupIndices: number[]) {
		let featureIndex = 0;

		for (let i = 0, ii = textures.length; i < ii; ++i) {
			gl.bindTexture(TEXTURE_2D, textures[i]);
			const groupStart = (i > 0) ? groupIndices[i - 1] : 0;
			const groupEnd = groupIndices[i];

			let start = groupStart;
			let end = groupStart;
			while (featureIndex < this.startIndices.length &&
				this.startIndices[featureIndex] <= groupEnd) {
				const feature = this.startIndicesFeature[featureIndex];

				const featureUid = getUid(feature).toString();
				if (skippedFeaturesHash[featureUid] !== undefined) {
					// feature should be skipped
					if (start !== end) {
						// draw the features so far
						this.drawElements(gl, context, start, end);
					}
					// continue with the next feature
					start = (featureIndex === this.startIndices.length - 1) ?
						groupEnd : this.startIndices[featureIndex + 1];
					end = start;
				} else {
					// the feature is not skipped, augment the end index
					end = (featureIndex === this.startIndices.length - 1) ?
						groupEnd : this.startIndices[featureIndex + 1];
				}
				featureIndex++;
			}

			if (start !== end) {
				// draw the remaining features (in case there was no skipped feature
				// in this texture group, all features of a group are drawn together)
				this.drawElements(gl, context, start, end);
			}
		}
	}

	protected drawHitDetectionReplayOneByOne<T>(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, featureCallback: (module: Feature | RenderFeature) => T | undefined, opt_hitExtent?: Extent) {
		// let groupStart, start, end, feature, featureUid;
		let featureIndex = this.startIndices.length - 1;
		const hitDetectionTextures = this.getHitDetectionTextures();
		for (let i = hitDetectionTextures.length - 1; i >= 0; --i) {
			gl.bindTexture(TEXTURE_2D, hitDetectionTextures[i]);
			const groupStart = (i > 0) ? this.hitDetectionGroupIndices[i - 1] : 0;
			let end = this.hitDetectionGroupIndices[i];

			// draw all features for this texture group
			while (featureIndex >= 0 &&
				this.startIndices[featureIndex] >= groupStart) {
				const start = this.startIndices[featureIndex];
				const feature = this.startIndicesFeature[featureIndex];
				const featureUid = getUid(feature).toString();

				if (skippedFeaturesHash[featureUid] === undefined &&
					feature.getGeometry() &&
					(opt_hitExtent === undefined || intersects((opt_hitExtent), feature.getGeometry().getExtent()))) {
					gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
					this.drawElements(gl, context, start, end);

					const result = featureCallback(feature);
					if (result) {
						return result;
					}
				}

				end = start;
				featureIndex--;
			}
		}
		return undefined;
	}


	/**
	 * @abstract
	 * @protected
	 * @param {boolean=} opt_all Return hit detection textures with regular ones.
	 * @returns {Array.<WebGLTexture>} Textures.
	 */
	protected abstract getTextures(opt_all?: boolean): WebGLTexture[];

	/**
	 * @abstract
	 * @protected
	 * @returns {Array.<WebGLTexture>} Textures.
	 */
	protected abstract getHitDetectionTextures(): WebGLTexture[];
}
