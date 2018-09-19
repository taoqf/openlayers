/**
 * @module ol/render/webgl/CircleReplay
 */
import { equals } from '../../array';
import { asArray } from '../../color';
import { Extent, intersects } from '../../extent';
import Feature from '../../Feature';
import Circle from '../../geom/Circle';
import { translate } from '../../geom/flat/transform';
import Geometry from '../../geom/Geometry';
import GeometryCollection from '../../geom/GeometryCollection';
import LineString from '../../geom/LineString';
import MultiLineString from '../../geom/MultiLineString';
import MultiPoint from '../../geom/MultiPoint';
import MultiPolygon from '../../geom/MultiPolygon';
import Point from '../../geom/Point';
import Polygon from '../../geom/Polygon';
import SimpleGeometry from '../../geom/SimpleGeometry';
import { getUid } from '../../index';
import { isEmpty } from '../../obj';
import { Size } from '../../size';
import { Image, Style } from '../../style';
import Fill from '../../style/Fill';
import Stroke from '../../style/Stroke';
import Text from '../../style/Text';
import { FLOAT } from '../../webgl';
import WebGLBuffer from '../../webgl/Buffer';
import WebGLContext from '../../webgl/Context';
import { DeclutterGroup } from '../canvas';
import RenderFeature from '../Feature';
import {
	DEFAULT_FILLSTYLE,
	DEFAULT_LINEDASH,
	DEFAULT_LINEDASHOFFSET,
	DEFAULT_LINEWIDTH,
	DEFAULT_STROKESTYLE
} from '../webgl';
import { fragment, vertex } from '../webgl/circlereplay/defaultshader';
import Locations from '../webgl/circlereplay/defaultshader/Locations';
import WebGLReplay from './Replay';

/**
 * @constructor
 * @extends {module:ol/render/webgl/Replay}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @struct
 */
export default class WebGLCircleReplay extends WebGLReplay {
	private defaultLocations_: Locations;
	private styles_: Array<Array<number[] | number>>;
	private styleIndices_: number[];
	private radius_: number;
	private state_: {
		fillColor: number[] | null;
		strokeColor: number[] | null;
		lineDash: number[];
		lineDashOffset: number | undefined;
		lineWidth: number | undefined;
		changed: boolean;
	};
	constructor(tolerance: number, maxExtent: Extent) {
		super(tolerance, maxExtent);

		/**
		 * @private
		 * @type {module:ol/render/webgl/circlereplay/defaultshader/Locations}
		 */
		this.defaultLocations_ = null;

		/**
		 * @private
		 * @type {Array.<Array.<Array.<number>|number>>}
		 */
		this.styles_ = [];

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.styleIndices_ = [];

		/**
		 * @private
		 * @type {number}
		 */
		this.radius_ = 0;

		/**
		 * @private
		 * @type {{fillColor: (Array.<number>|null),
		 *         strokeColor: (Array.<number>|null),
		 *         lineDash: Array.<number>,
		 *         lineDashOffset: (number|undefined),
		 *         lineWidth: (number|undefined),
		 *         changed: boolean}|null}
		 */
		this.state_ = {
			changed: false,
			fillColor: null,
			lineDash: null,
			lineDashOffset: undefined,
			lineWidth: undefined,
			strokeColor: null
		};

	}
	public drawMultiLineString(_multiLineStringGeometry: MultiLineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawLineString(_lineStringGeometry: LineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public setTextStyle(_textStyle: Text, _opt_declutterGroup?: DeclutterGroup) { }
	public setStyle(_style: Style) { }
	public setImageStyle(_imageStyle: Image, _opt_declutterGroup?: DeclutterGroup) { }
	public drawText(_geometry: Geometry | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawPolygon(_polygonGeometry: Polygon | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawPoint(_pointGeometry: Point | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawMultiPolygon(_multiPolygonGeometry: MultiPolygon, _feature: Feature | RenderFeature) { }
	public drawMultiPoint(_multiPointGeometry: MultiPoint | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawGeometryCollection(_geometryCollectionGeometry: GeometryCollection, _feature: Feature) { }
	public drawGeometry(_geometry: Geometry) { }
	public drawFeature(_feature: Feature, _style: Style) { }
	public drawCustom(_geometry: SimpleGeometry, _feature: Feature | RenderFeature, _renderer: () => void) { }

	public setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke) {
		let strokeStyleColor;
		let strokeStyleWidth;
		if (strokeStyle) {
			const strokeStyleLineDash = strokeStyle.getLineDash();
			this.state_.lineDash = strokeStyleLineDash ?
				strokeStyleLineDash : DEFAULT_LINEDASH;
			const strokeStyleLineDashOffset = strokeStyle.getLineDashOffset();
			this.state_.lineDashOffset = strokeStyleLineDashOffset ?
				strokeStyleLineDashOffset : DEFAULT_LINEDASHOFFSET;
			strokeStyleColor = strokeStyle.getColor();
			if (!(strokeStyleColor instanceof CanvasGradient) &&
				!(strokeStyleColor instanceof CanvasPattern)) {
				strokeStyleColor = asArray(strokeStyleColor).map((c, i) => {
					return i !== 3 ? c / 255 : c;
				}) || DEFAULT_STROKESTYLE;
			} else {
				strokeStyleColor = DEFAULT_STROKESTYLE;
			}
			strokeStyleWidth = strokeStyle.getWidth();
			strokeStyleWidth = strokeStyleWidth !== undefined ?
				strokeStyleWidth : DEFAULT_LINEWIDTH;
		} else {
			strokeStyleColor = [0, 0, 0, 0];
			strokeStyleWidth = 0;
		}
		let fillStyleColor = fillStyle ? fillStyle.getColor() : [0, 0, 0, 0];
		if (!(fillStyleColor instanceof CanvasGradient) &&
			!(fillStyleColor instanceof CanvasPattern)) {
			fillStyleColor = asArray(fillStyleColor as string).map((c, i) => {
				return i !== 3 ? c / 255 : c;
			}) || DEFAULT_FILLSTYLE;
		} else {
			fillStyleColor = DEFAULT_FILLSTYLE;
		}
		if (!this.state_.strokeColor || !equals(this.state_.strokeColor, strokeStyleColor) ||
			!this.state_.fillColor || !equals(this.state_.fillColor, fillStyleColor) ||
			this.state_.lineWidth !== strokeStyleWidth) {
			this.state_.changed = true;
			this.state_.fillColor = fillStyleColor;
			this.state_.strokeColor = strokeStyleColor;
			this.state_.lineWidth = strokeStyleWidth;
			this.styles_.push([fillStyleColor, strokeStyleColor, strokeStyleWidth]);
		}
	}

	public drawCircle(circleGeometry: Circle, feature: Feature) {
		const radius = circleGeometry.getRadius();
		const stride = circleGeometry.getStride();
		if (radius) {
			this.startIndices.push(this.indices.length);
			this.startIndicesFeature.push(feature);
			if (this.state_.changed) {
				this.styleIndices_.push(this.indices.length);
				this.state_.changed = false;
			}

			this.radius_ = radius;
			let flatCoordinates = circleGeometry.getFlatCoordinates();
			flatCoordinates = translate(flatCoordinates, 0, 2,
				stride, -this.origin[0], -this.origin[1]);
			this.drawCoordinates_(flatCoordinates, 0, 2, stride);
		} else {
			if (this.state_.changed) {
				this.styles_.pop();
				if (this.styles_.length) {
					const lastState = this.styles_[this.styles_.length - 1];
					this.state_.fillColor = lastState[0] as number[];
					this.state_.strokeColor = lastState[1] as number[];
					this.state_.lineWidth = lastState[2] as number;
					this.state_.changed = false;
				}
			}
		}
	}

	public finish(_context: WebGLContext) {
		// create, bind, and populate the vertices buffer
		this.verticesBuffer = new WebGLBuffer(this.vertices);

		// create, bind, and populate the indices buffer
		this.indicesBuffer = new WebGLBuffer(this.indices);

		this.startIndices.push(this.indices.length);

		// Clean up, if there is nothing to draw
		if (this.styleIndices_.length === 0 && this.styles_.length > 0) {
			this.styles_ = [];
		}

		this.vertices = null;
		this.indices = null;
	}

	public getDeleteResourcesFunction(context: WebGLContext) {
		// We only delete our stuff here. The shaders and the program may
		// be used by other CircleReplay instances (for other layers). And
		// they will be deleted when disposing of the module:ol/webgl/Context~WebGLContext
		// object.
		const verticesBuffer = this.verticesBuffer;
		const indicesBuffer = this.indicesBuffer;
		return () => {
			context.deleteBuffer(verticesBuffer);
			context.deleteBuffer(indicesBuffer);
		};
	}

	protected setUpProgram(gl: WebGLRenderingContext, context: WebGLContext, size: Size, pixelRatio: number) {
		// get the program
		const program = context.getProgram(fragment, vertex);

		// get the locations
		let locations;
		if (!this.defaultLocations_) {
			locations = new Locations(gl, program);
			this.defaultLocations_ = locations;
		} else {
			locations = this.defaultLocations_;
		}

		context.useProgram(program);

		// enable the vertex attrib arrays
		gl.enableVertexAttribArray(locations.a_position);
		gl.vertexAttribPointer(locations.a_position, 2, FLOAT,
			false, 16, 0);

		gl.enableVertexAttribArray(locations.a_instruction);
		gl.vertexAttribPointer(locations.a_instruction, 1, FLOAT,
			false, 16, 8);

		gl.enableVertexAttribArray(locations.a_radius);
		gl.vertexAttribPointer(locations.a_radius, 1, FLOAT,
			false, 16, 12);

		// Enable renderer specific uniforms.
		gl.uniform2fv(locations.u_size, size);
		gl.uniform1f(locations.u_pixelRatio, pixelRatio);

		return locations;
	}

	protected shutDownProgram(gl: WebGLRenderingContext, locations: Locations) {
		gl.disableVertexAttribArray(locations.a_position);
		gl.disableVertexAttribArray(locations.a_instruction);
		gl.disableVertexAttribArray(locations.a_radius);
	}

	protected drawReplay(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, _hitDetection: boolean) {
		if (!isEmpty(skippedFeaturesHash)) {
			this.drawReplaySkipping_(gl, context, skippedFeaturesHash);
		} else {
			// Draw by style groups to minimize drawElements() calls.
			let end = this.startIndices[this.startIndices.length - 1];
			for (let i = this.styleIndices_.length - 1; i >= 0; --i) {
				const start = this.styleIndices_[i];
				const nextStyle = this.styles_[i];
				this.setFillStyle_(gl, nextStyle[0] as number[]);
				this.setStrokeStyle_(gl, nextStyle[1] as number[], nextStyle[2] as number);
				this.drawElements(gl, context, start, end);
				end = start;
			}
		}
	}

	protected drawHitDetectionReplayOneByOne<T>(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, featureCallback: (module: Feature | RenderFeature) => T | undefined, opt_hitExtent?: Extent) {
		let featureIndex = this.startIndices.length - 2;
		let end = this.startIndices[featureIndex + 1];
		for (let i = this.styleIndices_.length - 1; i >= 0; --i) {
			const nextStyle = this.styles_[i];
			this.setFillStyle_(gl, nextStyle[0] as number[]);
			this.setStrokeStyle_(gl, nextStyle[1] as number[], nextStyle[2] as number);
			const groupStart = this.styleIndices_[i];

			while (featureIndex >= 0 &&
				this.startIndices[featureIndex] >= groupStart) {
				const start = this.startIndices[featureIndex];
				const feature = this.startIndicesFeature[featureIndex];
				const featureUid = getUid(feature).toString();

				if (skippedFeaturesHash[featureUid] === undefined &&
					feature.getGeometry() &&
					(opt_hitExtent === undefined || intersects(
					/** @type {Array<number>} */(opt_hitExtent),
						feature.getGeometry().getExtent()))) {
					gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
					this.drawElements(gl, context, start, end);

					const result = featureCallback(feature);

					if (result) {
						return result;
					}

				}
				featureIndex--;
				end = start;
			}
		}
		return undefined;
	}

	/**
	 * @private
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {module:ol/webgl/Context} context Context.
	 * @param {Object} skippedFeaturesHash Ids of features to skip.
	 */
	private drawReplaySkipping_(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }) {
		let featureIndex = this.startIndices.length - 2;
		let start = this.startIndices[featureIndex + 1];
		let end = start;
		for (let i = this.styleIndices_.length - 1; i >= 0; --i) {
			const nextStyle = this.styles_[i];
			this.setFillStyle_(gl, nextStyle[0] as number[]);
			this.setStrokeStyle_(gl, nextStyle[1] as number[], nextStyle[2] as number);
			const groupStart = this.styleIndices_[i];

			while (featureIndex >= 0 &&
				this.startIndices[featureIndex] >= groupStart) {
				const featureStart = this.startIndices[featureIndex];
				const feature = this.startIndicesFeature[featureIndex];
				const featureUid = getUid(feature).toString();

				if (skippedFeaturesHash[featureUid]) {
					if (start !== end) {
						this.drawElements(gl, context, start, end);
					}
					end = featureStart;
				}
				featureIndex--;
				start = featureStart;
			}
			if (start !== end) {
				this.drawElements(gl, context, start, end);
			}
			start = end = groupStart;
		}
	}


	/**
	 * @private
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {Array.<number>} color Color.
	 */
	private setFillStyle_(gl: WebGLRenderingContext, color: number[]) {
		gl.uniform4fv(this.defaultLocations_.u_fillColor, color);
	}


	/**
	 * @private
	 * @param {WebGLRenderingContext} gl gl.
	 * @param {Array.<number>} color Color.
	 * @param {number} lineWidth Line width.
	 */
	private setStrokeStyle_(gl: WebGLRenderingContext, color: number[], lineWidth: number) {
		gl.uniform4fv(this.defaultLocations_.u_strokeColor, color);
		gl.uniform1f(this.defaultLocations_.u_lineWidth, lineWidth);
	}

	/**
	 * @private
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 */
	private drawCoordinates_(flatCoordinates: number[], offset: number, end: number, stride: number) {
		let numVertices = this.vertices.length;
		let numIndices = this.indices.length;
		let n = numVertices / 4;
		for (let i = offset, ii = end; i < ii; i += stride) {
			this.vertices[numVertices++] = flatCoordinates[i];
			this.vertices[numVertices++] = flatCoordinates[i + 1];
			this.vertices[numVertices++] = 0;
			this.vertices[numVertices++] = this.radius_;

			this.vertices[numVertices++] = flatCoordinates[i];
			this.vertices[numVertices++] = flatCoordinates[i + 1];
			this.vertices[numVertices++] = 1;
			this.vertices[numVertices++] = this.radius_;

			this.vertices[numVertices++] = flatCoordinates[i];
			this.vertices[numVertices++] = flatCoordinates[i + 1];
			this.vertices[numVertices++] = 2;
			this.vertices[numVertices++] = this.radius_;

			this.vertices[numVertices++] = flatCoordinates[i];
			this.vertices[numVertices++] = flatCoordinates[i + 1];
			this.vertices[numVertices++] = 3;
			this.vertices[numVertices++] = this.radius_;

			this.indices[numIndices++] = n;
			this.indices[numIndices++] = n + 1;
			this.indices[numIndices++] = n + 2;

			this.indices[numIndices++] = n + 2;
			this.indices[numIndices++] = n + 3;
			this.indices[numIndices++] = n;

			n += 4;
		}
	}
}
