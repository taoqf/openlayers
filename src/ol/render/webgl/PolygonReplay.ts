/**
 * @module ol/render/webgl/PolygonReplay
 */
import { equals } from '../../array';
import { asArray, Color } from '../../color';
import { Coordinate } from '../../coordinate';
import { Extent, intersects } from '../../extent';
import Feature from '../../Feature';
import Circle from '../../geom/Circle';
import { linearRingContainsXY } from '../../geom/flat/contains';
import { linearRingIsClockwise } from '../../geom/flat/orient';
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
import LinkedList from '../../structs/LinkedList';
import RBush from '../../structs/RBush';
import { Image } from '../../style';
import Fill from '../../style/Fill';
import Stroke from '../../style/Stroke';
import Style from '../../style/Style';
import Text from '../../style/Text';
import { FLOAT } from '../../webgl';
import WebGLBuffer from '../../webgl/Buffer';
import WebGLContext from '../../webgl/Context';
import { DeclutterGroup } from '../canvas';
import RenderFeature from '../Feature';
import { DEFAULT_FILLSTYLE, EPSILON, triangleIsCounterClockwise } from '../webgl';
import WebGLLineStringReplay from '../webgl/LineStringReplay';
import { fragment, vertex } from '../webgl/polygonreplay/defaultshader';
import Locations from '../webgl/polygonreplay/defaultshader/Locations';
import WebGLReplay from '../webgl/Replay';


/**
 * @typedef {Object} PolygonVertex
 * @property {number} x
 * @property {number} y
 * @property {number} i
 * @property {boolean} [reflex]
 */

interface PolygonVertex {
	x: number;
	y: number;
	i: number;
	reflex?: boolean;
}

/**
 * @typedef {Object} PolygonSegment
 * @property {module:ol/render/webgl/PolygonReplay~PolygonVertex} p0
 * @property {module:ol/render/webgl/PolygonReplay~PolygonVertex} p1
 */

interface PolygonSegment {
	p0: PolygonVertex;
	p1: PolygonVertex;
}

/**
 * @constructor
 * @extends {module:ol/render/webgl/Replay}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @struct
 */
export default class WebGLPolygonReplay extends WebGLReplay {
	private defaultLocations_: Locations;
	private styles_: number[][];
	private styleIndices_: number[];
	private state_: {
		fillColor: number[] | null;
		changed: boolean;
	};
	constructor(tolerance: number, maxExtent: Extent) {
		super(tolerance, maxExtent);

		this.lineStringReplay = new WebGLLineStringReplay(
			tolerance, maxExtent);

		/**
		 * @private
		 * @type {module:ol/render/webgl/polygonreplay/defaultshader/Locations}
		 */
		this.defaultLocations_ = null;

		/**
		 * @private
		 * @type {Array.<Array.<number>>}
		 */
		this.styles_ = [];

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.styleIndices_ = [];

		/**
		 * @private
		 * @type {{fillColor: (Array.<number>|null),
		 *         changed: boolean}|null}
		 */
		this.state_ = {
			changed: false,
			fillColor: null
		};

	}
	public drawCircle(_circleGeometry: Circle, _feature: Feature) { }
	public setImageStyle(_imageStyle: Image, _opt_declutterGroup?: DeclutterGroup) { }
	public drawText(_geometry: Geometry | RenderFeature, _feature: Feature | RenderFeature) { }
	public setTextStyle(_textStyle: Text, _opt_declutterGroup?: DeclutterGroup) { }
	public drawMultiLineString(_multiLineStringGeometry: MultiLineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawLineString(_lineStringGeometry: LineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawCustom(_geometry: SimpleGeometry, _feature: Feature | RenderFeature, _renderer: () => void) { }
	public setStyle(_style: Style) { }
	public drawGeometry(_geometry: Geometry) { }
	public drawFeature(_feature: Feature, _style: Style) { }
	public drawGeometryCollection(_geometryCollectionGeometry: GeometryCollection, _feature: Feature) { }
	public drawPoint(_pointGeometry: Point | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawMultiPoint(_multiPointGeometry: MultiPoint | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawMultiPolygon(multiPolygonGeometry: MultiPolygon, feature: Feature | RenderFeature) {
		const endss = multiPolygonGeometry.getEndss();
		const stride = multiPolygonGeometry.getStride();
		const currIndex = this.indices.length;
		const currLineIndex = this.lineStringReplay.getCurrentIndex();
		const flatCoordinates = multiPolygonGeometry.getFlatCoordinates();
		let start = 0;
		for (let i = 0, ii = endss.length; i < ii; ++i) {
			const ends = endss[i];
			if (ends.length > 0) {
				const outerRing = translate(flatCoordinates, start, ends[0],
					stride, -this.origin[0], -this.origin[1]);
				if (outerRing.length) {
					const holes = [];
					let holeFlatCoords;
					for (let j = 1, jj = ends.length; j < jj; ++j) {
						if (ends[j] !== ends[j - 1]) {
							holeFlatCoords = translate(flatCoordinates, ends[j - 1],
								ends[j], stride, -this.origin[0], -this.origin[1]);
							holes.push(holeFlatCoords);
						}
					}
					this.lineStringReplay.drawPolygonCoordinates(outerRing, holes, stride);
					this.drawCoordinates_(outerRing, holes, stride);
				}
			}
			start = ends[ends.length - 1];
		}
		if (this.indices.length > currIndex) {
			this.startIndices.push(currIndex);
			this.startIndicesFeature.push(feature);
			if (this.state_.changed) {
				this.styleIndices_.push(currIndex);
				this.state_.changed = false;
			}
		}
		if (this.lineStringReplay.getCurrentIndex() > currLineIndex) {
			this.lineStringReplay.setPolygonStyle(feature, currLineIndex);
		}
	}

	public setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke) {
		let fillStyleColor = fillStyle ? fillStyle.getColor() : [0, 0, 0, 0] as Color;
		if (!(fillStyleColor instanceof CanvasGradient) &&
			!(fillStyleColor instanceof CanvasPattern)) {
			fillStyleColor = asArray(fillStyleColor).map((c, i) => {
				return i !== 3 ? c / 255 : c;
			}) as Color || DEFAULT_FILLSTYLE;
		} else {
			fillStyleColor = DEFAULT_FILLSTYLE;
		}
		if (!this.state_.fillColor || !equals(fillStyleColor, this.state_.fillColor)) {
			this.state_.fillColor = fillStyleColor;
			this.state_.changed = true;
			this.styles_.push(fillStyleColor);
		}
		// Provide a null stroke style, if no strokeStyle is provided. Required for the draw interaction to work.
		if (strokeStyle) {
			this.lineStringReplay.setFillStrokeStyle(null, strokeStyle);
		} else {
			const nullStrokeStyle = new Stroke({
				color: [0, 0, 0, 0]
				// todo linewidth is not defined in stroke options
				// lineWidth: 0
			});
			this.lineStringReplay.setFillStrokeStyle(null, nullStrokeStyle);
		}
	}

	public drawPolygon(polygonGeometry: Polygon | RenderFeature, feature: Feature | RenderFeature) {
		const ends = polygonGeometry.getEnds() as number[];
		const stride = polygonGeometry.getStride();
		if (ends.length > 0) {
			const flatCoordinates = polygonGeometry.getFlatCoordinates().map(Number);
			const outerRing = translate(flatCoordinates, 0, ends[0], stride, -this.origin[0], -this.origin[1]);
			if (outerRing.length) {
				const holes = [];
				for (let i = 1, ii = ends.length; i < ii; ++i) {
					if (ends[i] !== ends[i - 1]) {
						const holeFlatCoords = translate(flatCoordinates, ends[i - 1], ends[i], stride, -this.origin[0], -this.origin[1]);
						holes.push(holeFlatCoords);
					}
				}

				this.startIndices.push(this.indices.length);
				this.startIndicesFeature.push(feature);
				if (this.state_.changed) {
					this.styleIndices_.push(this.indices.length);
					this.state_.changed = false;
				}
				this.lineStringReplay.setPolygonStyle(feature);

				this.lineStringReplay.drawPolygonCoordinates(outerRing, holes, stride);
				this.drawCoordinates_(outerRing, holes, stride);
			}
		}
	}

	public finish(context: WebGLContext) {
		// create, bind, and populate the vertices buffer
		this.verticesBuffer = new WebGLBuffer(this.vertices);

		// create, bind, and populate the indices buffer
		this.indicesBuffer = new WebGLBuffer(this.indices);

		this.startIndices.push(this.indices.length);

		this.lineStringReplay.finish(context);

		// Clean up, if there is nothing to draw
		if (this.styleIndices_.length === 0 && this.styles_.length > 0) {
			this.styles_ = [];
		}

		this.vertices = null;
		this.indices = null;
	}


	public getDeleteResourcesFunction(context: WebGLContext) {
		const verticesBuffer = this.verticesBuffer;
		const indicesBuffer = this.indicesBuffer;
		const lineDeleter = this.lineStringReplay.getDeleteResourcesFunction(context);
		return () => {
			context.deleteBuffer(verticesBuffer);
			context.deleteBuffer(indicesBuffer);
			lineDeleter();
		};
	}

	protected setUpProgram(gl: WebGLRenderingContext, context: WebGLContext, _size: Size, _pixelRatio: number) {
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
			false, 8, 0);

		return locations;
	}

	protected shutDownProgram(gl: WebGLRenderingContext, locations: Locations) {
		gl.disableVertexAttribArray(locations.a_position);
	}

	protected drawReplay(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, hitDetection: boolean) {
		// Save GL parameters.
		const tmpDepthFunc = /** @type {number} */ (gl.getParameter(gl.DEPTH_FUNC));
		const tmpDepthMask = /** @type {boolean} */ (gl.getParameter(gl.DEPTH_WRITEMASK));

		if (!hitDetection) {
			gl.enable(gl.DEPTH_TEST);
			gl.depthMask(true);
			gl.depthFunc(gl.NOTEQUAL);
		}

		if (!isEmpty(skippedFeaturesHash)) {
			this.drawReplaySkipping_(gl, context, skippedFeaturesHash);
		} else {
			// Draw by style groups to minimize drawElements() calls.
			let end = this.startIndices[this.startIndices.length - 1];
			for (let i = this.styleIndices_.length - 1; i >= 0; --i) {
				const start = this.styleIndices_[i];
				const nextStyle = this.styles_[i];
				this.setFillStyle_(gl, nextStyle);
				this.drawElements(gl, context, start, end);
				end = start;
			}
		}
		if (!hitDetection) {
			gl.disable(gl.DEPTH_TEST);
			gl.clear(gl.DEPTH_BUFFER_BIT);
			// Restore GL parameters.
			gl.depthMask(tmpDepthMask);
			gl.depthFunc(tmpDepthFunc);
		}
	}


	protected drawHitDetectionReplayOneByOne<T>(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [feature: string]: boolean; }, featureCallback: (module: Feature | RenderFeature) => T | undefined, opt_hitExtent?: Extent) {
		let featureIndex = this.startIndices.length - 2;
		let end = this.startIndices[featureIndex + 1];
		for (let i = this.styleIndices_.length - 1; i >= 0; --i) {
			const nextStyle = this.styles_[i];
			this.setFillStyle_(gl, nextStyle);
			const groupStart = this.styleIndices_[i];

			while (featureIndex >= 0 &&
				this.startIndices[featureIndex] >= groupStart) {
				const start = this.startIndices[featureIndex];
				const feature = this.startIndicesFeature[featureIndex];
				const featureUid = getUid(feature).toString();

				if (skippedFeaturesHash[featureUid] === undefined && feature.getGeometry() && (opt_hitExtent === undefined || intersects((opt_hitExtent), feature.getGeometry().getExtent()))) {
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
	private drawReplaySkipping_(gl: WebGLRenderingContext, context: WebGLContext, skippedFeaturesHash: { [featureid: string]: boolean; }) {
		let featureIndex = this.startIndices.length - 2;
		let start = this.startIndices[featureIndex + 1];
		let end = start;
		for (let i = this.styleIndices_.length - 1; i >= 0; --i) {
			const nextStyle = this.styles_[i];
			this.setFillStyle_(gl, nextStyle);
			const groupStart = this.styleIndices_[i];

			while (featureIndex >= 0 &&
				this.startIndices[featureIndex] >= groupStart) {
				const featureStart = this.startIndices[featureIndex];
				const feature = this.startIndicesFeature[featureIndex];
				const featureUid = getUid(feature).toString();

				if (skippedFeaturesHash[featureUid]) {
					if (start !== end) {
						this.drawElements(gl, context, start, end);
						gl.clear(gl.DEPTH_BUFFER_BIT);
					}
					end = featureStart;
				}
				featureIndex--;
				start = featureStart;
			}
			if (start !== end) {
				this.drawElements(gl, context, start, end);
				gl.clear(gl.DEPTH_BUFFER_BIT);
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
		gl.uniform4fv(this.defaultLocations_.u_color, color);
	}

	/**
	 * Draw one polygon.
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {Array.<Array.<number>>} holeFlatCoordinates Hole flat coordinates.
	 * @param {number} stride Stride.
	 * @private
	 */
	private drawCoordinates_(flatCoordinates: number[], holeFlatCoordinates: number[][], stride: number) {
		// Triangulate the polygon
		const outerRing = new LinkedList<PolygonSegment>();
		const rtree = new RBush<PolygonSegment>();
		// Initialize the outer ring
		this.processFlatCoordinates_(flatCoordinates, stride, outerRing, rtree, true);
		const maxCoords = this.getMaxCoords_(outerRing);

		// Eliminate holes, if there are any
		if (holeFlatCoordinates.length) {
			interface HoleList {
				list: LinkedList<PolygonSegment>;
				maxCoords: Coordinate;
				rtree: RBush<PolygonSegment>;
			}
			const holeLists = [] as HoleList[];
			for (let i = 0, ii = holeFlatCoordinates.length; i < ii; ++i) {
				const holeList = {
					list: new LinkedList<PolygonSegment>(),
					maxCoords: undefined as Coordinate,
					rtree: new RBush<PolygonSegment>()
				};
				holeLists.push(holeList);
				this.processFlatCoordinates_(holeFlatCoordinates[i], stride, holeList.list, holeList.rtree, false);
				this.classifyPoints_(holeList.list, holeList.rtree, true);
				holeList.maxCoords = this.getMaxCoords_(holeList.list);
			}
			holeLists.sort((a, b) => {
				return b.maxCoords[0] === a.maxCoords[0] ?
					a.maxCoords[1] - b.maxCoords[1] : b.maxCoords[0] - a.maxCoords[0];
			});
			holeLists.forEach((holeList) => {
				const { list: currList } = holeList;
				const start = currList.firstItem();
				let currItem = start;
				let intersection;
				do {
					// TODO: Triangulate holes when they intersect the outer ring.
					if (this.getIntersections_(currItem, rtree).length) {
						intersection = true;
						break;
					}
					currItem = currList.nextItem();
				} while (start !== currItem);
				if (!intersection) {
					if (this.bridgeHole_(currList, holeList.maxCoords[0], outerRing, maxCoords[0], rtree)) {
						rtree.concat(holeList.rtree);
						this.classifyPoints_(outerRing, rtree, false);
					}
				}
			});
		} else {
			this.classifyPoints_(outerRing, rtree, false);
		}
		this.triangulate_(outerRing, rtree);
	}

	/**
	 * Inserts flat coordinates in a linked list and adds them to the vertex buffer.
	 * @private
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} stride Stride.
	 * @param {module:ol/structs/LinkedList} list Linked list.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @param {boolean} clockwise Coordinate order should be clockwise.
	 */
	private processFlatCoordinates_(flatCoordinates: number[], stride: number, list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>, clockwise: boolean) {
		const isClockwise = linearRingIsClockwise(flatCoordinates,
			0, flatCoordinates.length, stride);
		let n = this.vertices.length / 2;
		let start: PolygonVertex;
		let p0: PolygonVertex;
		let p1: PolygonVertex;
		const extents = [] as Extent[];
		const segments = [] as PolygonSegment[];
		if (clockwise === isClockwise) {
			start = this.createPoint_(flatCoordinates[0], flatCoordinates[1], n++);
			p0 = start;
			for (let i = stride, ii = flatCoordinates.length; i < ii; i += stride) {
				p1 = this.createPoint_(flatCoordinates[i], flatCoordinates[i + 1], n++);
				segments.push(this.insertItem_(p0, p1, list));
				extents.push([Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.max(p0.x, p1.x),
				Math.max(p0.y, p1.y)]);
				p0 = p1;
			}
			segments.push(this.insertItem_(p1, start, list));
			extents.push([Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.max(p0.x, p1.x),
			Math.max(p0.y, p1.y)]);
		} else {
			const end = flatCoordinates.length - stride;
			start = this.createPoint_(flatCoordinates[end], flatCoordinates[end + 1], n++);
			p0 = start;
			for (let i = end - stride, ii = 0; i >= ii; i -= stride) {
				p1 = this.createPoint_(flatCoordinates[i], flatCoordinates[i + 1], n++);
				segments.push(this.insertItem_(p0, p1, list));
				extents.push([Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.max(p0.x, p1.x),
				Math.max(p0.y, p1.y)]);
				p0 = p1;
			}
			segments.push(this.insertItem_(p1, start, list));
			extents.push([Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.max(p0.x, p1.x),
			Math.max(p0.y, p1.y)]);
		}
		rtree.load(extents, segments);
	}

	/**
	 * Returns the rightmost coordinates of a polygon on the X axis.
	 * @private
	 * @param {module:ol/structs/LinkedList} list Polygons ring.
	 * @return {Array.<number>} Max X coordinates.
	 */
	private getMaxCoords_(list: LinkedList<PolygonSegment>) {
		const start = list.firstItem();
		let seg = start;
		let maxCoords = [seg.p0.x, seg.p0.y] as Coordinate;

		do {
			seg = list.nextItem();
			if (seg.p0.x > maxCoords[0]) {
				maxCoords = [seg.p0.x, seg.p0.y];
			}
		} while (seg !== start);

		return maxCoords;
	}


	/**
	 * Classifies the points of a polygon list as convex, reflex. Removes collinear vertices.
	 * @private
	 * @param {module:ol/structs/LinkedList} list Polygon ring.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @param {boolean} ccw The orientation of the polygon is counter-clockwise.
	 * @return {boolean} There were reclassified points.
	 */
	private classifyPoints_(list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>, ccw: boolean) {
		let start = list.firstItem();
		let s0 = start;
		let s1 = list.nextItem();
		let pointsReclassified = false;
		do {
			const reflex = ccw ? triangleIsCounterClockwise(s1.p1.x,
				s1.p1.y, s0.p1.x, s0.p1.y, s0.p0.x, s0.p0.y) :
				triangleIsCounterClockwise(s0.p0.x, s0.p0.y, s0.p1.x,
					s0.p1.y, s1.p1.x, s1.p1.y);
			if (reflex === undefined) {
				this.removeItem_(s0, s1, list, rtree);
				pointsReclassified = true;
				if (s1 === start) {
					start = list.getNextItem();
				}
				s1 = s0;
				list.prevItem();
			} else if (s0.p1.reflex !== reflex) {
				s0.p1.reflex = reflex;
				pointsReclassified = true;
			}
			s0 = s1;
			s1 = list.nextItem();
		} while (s0 !== start);
		return pointsReclassified;
	}


	/**
	 * @private
	 * @param {module:ol/structs/LinkedList} hole Linked list of the hole.
	 * @param {number} holeMaxX Maximum X value of the hole.
	 * @param {module:ol/structs/LinkedList} list Linked list of the polygon.
	 * @param {number} listMaxX Maximum X value of the polygon.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @return {boolean} Bridging was successful.
	 */
	private bridgeHole_(hole: LinkedList<PolygonSegment>, holeMaxX: number, list: LinkedList<PolygonSegment>, listMaxX: number, rtree: RBush<PolygonSegment>) {
		let seg = hole.firstItem();
		while (seg.p1.x !== holeMaxX) {
			seg = hole.nextItem();
		}

		const p1 = seg.p1;
		const p2 = { x: listMaxX, y: p1.y, i: -1 } as PolygonVertex;
		let minDist = Infinity;
		let p5: PolygonVertex;

		const intersectingSegments = this.getIntersections_({ p0: p1, p1: p2 }, rtree, true);
		for (let i = 0, ii = intersectingSegments.length; i < ii; ++i) {
			const currSeg = intersectingSegments[i];
			const intersection = this.calculateIntersection_(p1, p2, currSeg.p0,
				currSeg.p1, true);
			const dist = Math.abs(p1.x - intersection[0]);
			if (dist < minDist && triangleIsCounterClockwise(p1.x, p1.y,
				currSeg.p0.x, currSeg.p0.y, currSeg.p1.x, currSeg.p1.y) !== undefined) {
				minDist = dist;
				p5 = { x: intersection[0], y: intersection[1], i: -1 };
				seg = currSeg;
			}
		}
		if (minDist === Infinity) {
			return false;
		}
		let bestPoint = seg.p1;

		if (minDist > 0) {
			const pointsInTriangle = this.getPointsInTriangle_(p1, p5, seg.p1, rtree);
			if (pointsInTriangle.length) {
				let theta = Infinity;
				for (let i = 0, ii = pointsInTriangle.length; i < ii; ++i) {
					const currPoint = pointsInTriangle[i];
					const currTheta = Math.atan2(p1.y - currPoint.y, p2.x - currPoint.x);
					if (currTheta < theta || (currTheta === theta && currPoint.x < bestPoint.x)) {
						theta = currTheta;
						bestPoint = currPoint;
					}
				}
			}
		}

		seg = list.firstItem();
		while (seg.p1.x !== bestPoint.x || seg.p1.y !== bestPoint.y) {
			seg = list.nextItem();
		}

		// We clone the bridge points as they can have different convexity.
		const p0Bridge = { x: p1.x, y: p1.y, i: p1.i, reflex: undefined } as PolygonVertex;
		const p1Bridge = { x: seg.p1.x, y: seg.p1.y, i: seg.p1.i, reflex: undefined } as PolygonVertex;

		hole.getNextItem().p0 = p0Bridge;
		this.insertItem_(p1, seg.p1, hole, rtree);
		this.insertItem_(p1Bridge, p0Bridge, hole, rtree);
		seg.p1 = p1Bridge;
		hole.setFirstItem();
		list.concat(hole);

		return true;
	}


	/**
	 * @private
	 * @param {module:ol/structs/LinkedList} list Linked list of the polygon.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 */
	private triangulate_(list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>) {
		let ccw = false;
		let simple = this.isSimple_(list, rtree);

		// Start clipping ears
		while (list.getLength() > 3) {
			if (simple) {
				if (!this.clipEars_(list, rtree, simple, ccw)) {
					if (!this.classifyPoints_(list, rtree, ccw)) {
						// Due to the behavior of OL's PIP algorithm, the ear clipping cannot
						// introduce touching segments. However, the original data may have some.
						if (!this.resolveSelfIntersections_(list, rtree, true)) {
							break;
						}
					}
				}
			} else {
				if (!this.clipEars_(list, rtree, simple, ccw)) {
					// We ran out of ears, try to reclassify.
					if (!this.classifyPoints_(list, rtree, ccw)) {
						// We have a bad polygon, try to resolve local self-intersections.
						if (!this.resolveSelfIntersections_(list, rtree)) {
							simple = this.isSimple_(list, rtree);
							if (!simple) {
								// We have a really bad polygon, try more time consuming methods.
								this.splitPolygon_(list, rtree);
								break;
							} else {
								ccw = !this.isClockwise_(list);
								this.classifyPoints_(list, rtree, ccw);
							}
						}
					}
				}
			}
		}
		if (list.getLength() === 3) {
			let numIndices = this.indices.length;
			this.indices[numIndices++] = list.getPrevItem().p0.i;
			this.indices[numIndices++] = list.getCurrItem().p0.i;
			this.indices[numIndices++] = list.getNextItem().p0.i;
		}
	}


	/**
	 * @private
	 * @param {module:ol/structs/LinkedList} list Linked list of the polygon.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @param {boolean} simple The polygon is simple.
	 * @param {boolean} ccw Orientation of the polygon is counter-clockwise.
	 * @return {boolean} There were processed ears.
	 */
	private clipEars_(list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>, simple: boolean, ccw: boolean) {
		let numIndices = this.indices.length;
		let start = list.firstItem();
		let s0 = list.getPrevItem();
		let s1 = start;
		let s2 = list.nextItem();
		let s3 = list.getNextItem();
		let processedEars = false;
		do {
			const p0 = s1.p0;
			const p1 = s1.p1;
			const p2 = s2.p1;
			if (p1.reflex === false) {
				// We might have a valid ear
				let variableCriterion;
				if (simple) {
					variableCriterion = this.getPointsInTriangle_(p0, p1, p2, rtree, true).length === 0;
				} else {
					variableCriterion = ccw ? this.diagonalIsInside_(s3.p1, p2, p1, p0,
						s0.p0) : this.diagonalIsInside_(s0.p0, p0, p1, p2, s3.p1);
				}
				if ((simple || this.getIntersections_({ p0, p1: p2 }, rtree).length === 0) &&
					variableCriterion) {
					// The diagonal is completely inside the polygon
					if (simple || p0.reflex === false || p2.reflex === false ||
						linearRingIsClockwise([s0.p0.x, s0.p0.y, p0.x,
						p0.y, p1.x, p1.y, p2.x, p2.y, s3.p1.x, s3.p1.y], 0, 10, 2) === !ccw) {
						// The diagonal is persumably valid, we have an ear
						this.indices[numIndices++] = p0.i;
						this.indices[numIndices++] = p1.i;
						this.indices[numIndices++] = p2.i;
						this.removeItem_(s1, s2, list, rtree);
						if (s2 === start) {
							start = s3;
						}
						processedEars = true;
					}
				}
			}
			// Else we have a reflex point.
			s0 = list.getPrevItem();
			s1 = list.getCurrItem();
			s2 = list.nextItem();
			s3 = list.getNextItem();
		} while (s1 !== start && list.getLength() > 3);

		return processedEars;
	}

	/**
	 * @private
	 * @param {module:ol/structs/LinkedList} list Linked list of the polygon.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @param {boolean=} opt_touch Resolve touching segments.
	 * @return {boolean} There were resolved intersections.
	 */
	private resolveSelfIntersections_(list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>, opt_touch?: boolean) {
		const start = list.firstItem();
		list.nextItem();
		let s0 = start;
		let s1 = list.nextItem();
		let resolvedIntersections = false;

		do {
			const intersection = this.calculateIntersection_(s0.p0, s0.p1, s1.p0, s1.p1,
				opt_touch);
			if (intersection) {
				let breakCond = false;
				const numVertices = this.vertices.length;
				let numIndices = this.indices.length;
				const n = numVertices / 2;
				const seg = list.prevItem();
				list.removeItem();
				rtree.remove(seg);
				breakCond = (seg === start);
				let p;
				if (opt_touch) {
					if (intersection[0] === s0.p0.x && intersection[1] === s0.p0.y) {
						list.prevItem();
						p = s0.p0;
						s1.p0 = p;
						rtree.remove(s0);
						breakCond = breakCond || (s0 === start);
					} else {
						p = s1.p1;
						s0.p1 = p;
						rtree.remove(s1);
						breakCond = breakCond || (s1 === start);
					}
					list.removeItem();
				} else {
					p = this.createPoint_(intersection[0], intersection[1], n);
					s0.p1 = p;
					s1.p0 = p;
					rtree.update([Math.min(s0.p0.x, s0.p1.x), Math.min(s0.p0.y, s0.p1.y),
					Math.max(s0.p0.x, s0.p1.x), Math.max(s0.p0.y, s0.p1.y)], s0);
					rtree.update([Math.min(s1.p0.x, s1.p1.x), Math.min(s1.p0.y, s1.p1.y),
					Math.max(s1.p0.x, s1.p1.x), Math.max(s1.p0.y, s1.p1.y)], s1);
				}

				this.indices[numIndices++] = seg.p0.i;
				this.indices[numIndices++] = seg.p1.i;
				this.indices[numIndices++] = p.i;

				resolvedIntersections = true;
				if (breakCond) {
					break;
				}
			}

			s0 = list.getPrevItem();
			s1 = list.nextItem();
		} while (s0 !== start);
		return resolvedIntersections;
	}


	/**
	 * @private
	 * @param {module:ol/structs/LinkedList} list Linked list of the polygon.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @return {boolean} The polygon is simple.
	 */
	private isSimple_(list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>) {
		const start = list.firstItem();
		let seg = start;
		do {
			if (this.getIntersections_(seg, rtree).length) {
				return false;
			}
			seg = list.nextItem();
		} while (seg !== start);
		return true;
	}

	/**
	 * @private
	 * @param {module:ol/structs/LinkedList} list Linked list of the polygon.
	 * @return {boolean} Orientation is clockwise.
	 */
	private isClockwise_(list: LinkedList<PolygonSegment>) {
		const length = list.getLength() * 2;
		const flatCoordinates = new Array(length);
		const start = list.firstItem();
		let seg = start;
		let i = 0;
		do {
			flatCoordinates[i++] = seg.p0.x;
			flatCoordinates[i++] = seg.p0.y;
			seg = list.nextItem();
		} while (seg !== start);
		return linearRingIsClockwise(flatCoordinates, 0, length, 2);
	}


	/**
	 * @private
	 * @param {module:ol/structs/LinkedList} list Linked list of the polygon.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 */
	private splitPolygon_(list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>) {
		const start = list.firstItem();
		let s0 = start;
		do {
			const intersections = this.getIntersections_(s0, rtree);
			if (intersections.length) {
				const s1 = intersections[0];
				const n = this.vertices.length / 2;
				const intersection = this.calculateIntersection_(s0.p0,
					s0.p1, s1.p0, s1.p1);
				const p = this.createPoint_(intersection[0], intersection[1], n);
				const newPolygon = new LinkedList<PolygonSegment>();
				const newRtree = new RBush<PolygonSegment>();
				this.insertItem_(p, s0.p1, newPolygon, newRtree);
				s0.p1 = p;
				rtree.update([Math.min(s0.p0.x, p.x), Math.min(s0.p0.y, p.y),
				Math.max(s0.p0.x, p.x), Math.max(s0.p0.y, p.y)], s0);
				let currItem = list.nextItem();
				while (currItem !== s1) {
					this.insertItem_(currItem.p0, currItem.p1, newPolygon, newRtree);
					rtree.remove(currItem);
					list.removeItem();
					currItem = list.getCurrItem();
				}
				this.insertItem_(s1.p0, p, newPolygon, newRtree);
				s1.p0 = p;
				rtree.update([Math.min(s1.p1.x, p.x), Math.min(s1.p1.y, p.y),
				Math.max(s1.p1.x, p.x), Math.max(s1.p1.y, p.y)], s1);
				this.classifyPoints_(list, rtree, false);
				this.triangulate_(list, rtree);
				this.classifyPoints_(newPolygon, newRtree, false);
				this.triangulate_(newPolygon, newRtree);
				break;
			}
			s0 = list.nextItem();
		} while (s0 !== start);
	}


	/**
	 * @private
	 * @param {number} x X coordinate.
	 * @param {number} y Y coordinate.
	 * @param {number} i Index.
	 * @return {module:ol/render/webgl/PolygonReplay~PolygonVertex} List item.
	 */
	private createPoint_(x: number, y: number, i: number) {
		let numVertices = this.vertices.length;
		this.vertices[numVertices++] = x;
		this.vertices[numVertices++] = y;
		return {
			i,
			reflex: undefined,
			x,
			y
		} as PolygonVertex;
	}


	/**
	 * @private
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p0 First point of segment.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p1 Second point of segment.
	 * @param {module:ol/structs/LinkedList} list Polygon ring.
	 * @param {module:ol/structs/RBush=} opt_rtree Insert the segment into the R-Tree.
	 * @return {module:ol/render/webgl/PolygonReplay~PolygonSegment} segment.
	 */
	private insertItem_(p0: PolygonVertex, p1: PolygonVertex, list: LinkedList<PolygonSegment>, opt_rtree?: RBush<PolygonSegment>) {
		const seg = {
			p0,
			p1
		};
		list.insertItem(seg);
		if (opt_rtree) {
			opt_rtree.insert([Math.min(p0.x, p1.x), Math.min(p0.y, p1.y),
			Math.max(p0.x, p1.x), Math.max(p0.y, p1.y)], seg);
		}
		return seg;
	}


	/**
	 * @private
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonSegment} s0 Segment before the remove candidate.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonSegment} s1 Remove candidate segment.
	 * @param {module:ol/structs/LinkedList} list Polygon ring.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 */
	private removeItem_(s0: PolygonSegment, s1: PolygonSegment, list: LinkedList<PolygonSegment>, rtree: RBush<PolygonSegment>) {
		if (list.getCurrItem() === s1) {
			list.removeItem();
			s0.p1 = s1.p1;
			rtree.remove(s1);
			rtree.update([Math.min(s0.p0.x, s0.p1.x), Math.min(s0.p0.y, s0.p1.y),
			Math.max(s0.p0.x, s0.p1.x), Math.max(s0.p0.y, s0.p1.y)], s0);
		}
	}


	/**
	 * @private
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p0 First point.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p1 Second point.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p2 Third point.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @param {boolean=} opt_reflex Only include reflex points.
	 * @return {Array.<module:ol/render/webgl/PolygonReplay~PolygonVertex>} Points in the triangle.
	 */
	private getPointsInTriangle_(p0: PolygonVertex, p1: PolygonVertex, p2: PolygonVertex, rtree: RBush<PolygonSegment>, opt_reflex?: boolean) {
		const result = [] as PolygonVertex[];
		const segmentsInExtent = rtree.getInExtent([Math.min(p0.x, p1.x, p2.x),
		Math.min(p0.y, p1.y, p2.y), Math.max(p0.x, p1.x, p2.x), Math.max(p0.y,
			p1.y, p2.y)]);
		for (let i = 0, ii = segmentsInExtent.length; i < ii; ++i) {
			(['p0', 'p1'] as Array<'p0' | 'p1'>).forEach((j) => {
				const p = segmentsInExtent[i][j];
				if (typeof p === 'object' && (!opt_reflex || p.reflex)) {
					if ((p.x !== p0.x || p.y !== p0.y) && (p.x !== p1.x || p.y !== p1.y) &&
						(p.x !== p2.x || p.y !== p2.y) && result.indexOf(p) === -1 &&
						linearRingContainsXY([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y], 0, 6, 2, p.x, p.y)) {
						result.push(p);
					}
				}
			});
		}
		return result;
	}


	/**
	 * @private
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonSegment} segment Segment.
	 * @param {module:ol/structs/RBush} rtree R-Tree of the polygon.
	 * @param {boolean=} opt_touch Touching segments should be considered an intersection.
	 * @return {Array.<module:ol/render/webgl/PolygonReplay~PolygonSegment>} Intersecting segments.
	 */
	private getIntersections_(segment: PolygonSegment, rtree: RBush<PolygonSegment>, opt_touch?: boolean) {
		const p0 = segment.p0;
		const p1 = segment.p1;
		const segmentsInExtent = rtree.getInExtent([Math.min(p0.x, p1.x),
		Math.min(p0.y, p1.y), Math.max(p0.x, p1.x), Math.max(p0.y, p1.y)]);
		const result = [];
		for (let i = 0, ii = segmentsInExtent.length; i < ii; ++i) {
			const currSeg = segmentsInExtent[i];
			if (segment !== currSeg && (opt_touch || currSeg.p0 !== p1 || currSeg.p1 !== p0) &&
				this.calculateIntersection_(p0, p1, currSeg.p0, currSeg.p1, opt_touch)) {
				result.push(currSeg);
			}
		}
		return result;
	}

	/**
	 * Line intersection algorithm by Paul Bourke.
	 * @see http://paulbourke.net/geometry/pointlineplane/
	 *
	 * @private
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p0 First point.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p1 Second point.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p2 Third point.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p3 Fourth point.
	 * @param {boolean=} opt_touch Touching segments should be considered an intersection.
	 * @return {Array.<number>|undefined} Intersection coordinates.
	 */
	private calculateIntersection_(p0: PolygonVertex, p1: PolygonVertex, p2: PolygonVertex, p3: PolygonVertex, opt_touch?: boolean) {
		const denom = (p3.y - p2.y) * (p1.x - p0.x) - (p3.x - p2.x) * (p1.y - p0.y);
		if (denom !== 0) {
			const ua = ((p3.x - p2.x) * (p0.y - p2.y) - (p3.y - p2.y) * (p0.x - p2.x)) / denom;
			const ub = ((p1.x - p0.x) * (p0.y - p2.y) - (p1.y - p0.y) * (p0.x - p2.x)) / denom;
			if ((!opt_touch && ua > EPSILON && ua < 1 - EPSILON &&
				ub > EPSILON && ub < 1 - EPSILON) || (opt_touch &&
					ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1)) {
				return [p0.x + ua * (p1.x - p0.x), p0.y + ua * (p1.y - p0.y)];
			}
		}
		return undefined;
	}


	/**
	 * @private
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p0 Point before the start of the diagonal.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p1 Start point of the diagonal.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p2 Ear candidate.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p3 End point of the diagonal.
	 * @param {module:ol/render/webgl/PolygonReplay~PolygonVertex} p4 Point after the end of the diagonal.
	 * @return {boolean} Diagonal is inside the polygon.
	 */
	private diagonalIsInside_(p0: PolygonVertex, p1: PolygonVertex, p2: PolygonVertex, p3: PolygonVertex, p4: PolygonVertex) {
		if (p1.reflex === undefined || p3.reflex === undefined) {
			return false;
		}
		const p1IsLeftOf = (p2.x - p3.x) * (p1.y - p3.y) > (p2.y - p3.y) * (p1.x - p3.x);
		const p1IsRightOf = (p4.x - p3.x) * (p1.y - p3.y) < (p4.y - p3.y) * (p1.x - p3.x);
		const p3IsLeftOf = (p0.x - p1.x) * (p3.y - p1.y) > (p0.y - p1.y) * (p3.x - p1.x);
		const p3IsRightOf = (p2.x - p1.x) * (p3.y - p1.y) < (p2.y - p1.y) * (p3.x - p1.x);
		const p1InCone = p3.reflex ? p1IsRightOf || p1IsLeftOf : p1IsRightOf && p1IsLeftOf;
		const p3InCone = p1.reflex ? p3IsRightOf || p3IsLeftOf : p3IsRightOf && p3IsLeftOf;
		return p1InCone && p3InCone;
	}
}
