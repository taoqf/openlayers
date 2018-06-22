/**
 * @module ol/geom/MultiPolygon
 */
import { extend } from '../array';
import { Coordinate } from '../coordinate';
import { closestSquaredDistanceXY, Extent } from '../extent';
import { linearRingss as linearRingssArea } from '../geom/flat/area';
import { linearRingss as linearRingssCenter } from '../geom/flat/center';
import { assignClosestMultiArrayPoint, multiArrayMaxSquaredDelta } from '../geom/flat/closest';
import { linearRingssContainsXY } from '../geom/flat/contains';
import { deflateMultiCoordinatesArray } from '../geom/flat/deflate';
import { inflateMultiCoordinatesArray } from '../geom/flat/inflate';
import { getInteriorPointsOfMultiArray } from '../geom/flat/interiorpoint';
import { intersectsLinearRingMultiArray } from '../geom/flat/intersectsextent';
import { linearRingsAreOriented, orientLinearRingsArray } from '../geom/flat/orient';
import { quantizeMultiArray } from '../geom/flat/simplify';
import GeometryLayout from '../geom/GeometryLayout';
import GeometryType from '../geom/GeometryType';
import MultiPoint from '../geom/MultiPoint';
import Polygon from '../geom/Polygon';
import SimpleGeometry from '../geom/SimpleGeometry';

/**
 * @classdesc
 * Multi-polygon geometry.
 *
 * @constructor
 * @extends {module:ol/geom/SimpleGeometry}
 * @param {Array.<Array.<Array.<module:ol/coordinate~Coordinate>>>} coordinates Coordinates.
 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
 * @api
 */
export default class MultiPolygon extends SimpleGeometry {
	/**
	 * @type {Array.<Array.<number>>}
	 * @private
	 */
	private endss: number[][] = [];

	/**
	 * @private
	 * @type {number}
	 */
	private flatInteriorPointsRevision = -1;

	/**
	 * @private
	 * @type {Array.<number>}
	 */
	private flatInteriorPoints: number[] = null!;

	/**
	 * @private
	 * @type {number}
	 */
	private maxDelta = -1;

	/**
	 * @private
	 * @type {number}
	 */
	private maxDeltaRevision = -1;

	/**
	 * @private
	 * @type {number}
	 */
	private orientedRevision = -1;

	/**
	 * @private
	 * @type {Array.<number>}
	 */
	private orientedFlatCoordinates: number[] = null!;

	constructor(coordinates: Coordinate[][][] | null, opt_layout?: GeometryLayout) {
		super();

		this.setCoordinates(coordinates, opt_layout);
	}

	/**
	 * Append the passed polygon to this multipolygon.
	 * @param {module:ol/geom/Polygon} polygon Polygon.
	 * @api
	 */
	public appendPolygon(polygon: Polygon) {
		/** @type {Array.<number>} */
		let ends;
		if (!this.flatCoordinates) {
			this.flatCoordinates = polygon.getFlatCoordinates().slice();
			ends = polygon.getEnds().slice();
			this.endss.push();
		} else {
			const offset = this.flatCoordinates.length;
			extend(this.flatCoordinates, polygon.getFlatCoordinates());
			ends = polygon.getEnds().slice();
			for (let i = 0, ii = ends.length; i < ii; ++i) {
				ends[i] += offset;
			}
		}
		this.endss.push(ends);
		this.changed();
	}


	/**
	 * Make a complete copy of the geometry.
	 * @return {!module:ol/geom/MultiPolygon} Clone.
	 * @override
	 * @api
	 */
	public clone() {
		const multiPolygon = new MultiPolygon(null);

		const len = this.endss.length;
		const newEndss = new Array(len);
		for (let i = 0; i < len; ++i) {
			newEndss[i] = this.endss[i].slice();
		}

		multiPolygon.setFlatCoordinates(
			this.layout, this.flatCoordinates.slice(), newEndss);
		return multiPolygon;
	}


	/**
	 * @inheritDoc
	 */
	public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number) {
		if (minSquaredDistance < closestSquaredDistanceXY(this.getExtent(), x, y)) {
			return minSquaredDistance;
		}
		if (this.maxDeltaRevision !== this.getRevision()) {
			this.maxDelta = Math.sqrt(multiArrayMaxSquaredDelta(
				this.flatCoordinates, 0, this.endss, this.stride, 0));
			this.maxDeltaRevision = this.getRevision();
		}
		return assignClosestMultiArrayPoint(
			this.getOrientedFlatCoordinates(), 0, this.endss, this.stride,
			this.maxDelta, true, x, y, closestPoint, minSquaredDistance);
	}


	/**
	 * @inheritDoc
	 */
	public containsXY(x: number, y: number) {
		return linearRingssContainsXY(this.getOrientedFlatCoordinates(), 0, this.endss, this.stride, x, y);
	}


	/**
	 * Return the area of the multipolygon on projected plane.
	 * @return {number} Area (on projected plane).
	 * @api
	 */
	public getArea() {
		return linearRingssArea(this.getOrientedFlatCoordinates(), 0, this.endss, this.stride);
	}


	/**
	 * Get the coordinate array for this geometry.  This array has the structure
	 * of a GeoJSON coordinate array for multi-polygons.
	 *
	 * @param {boolean=} opt_right Orient coordinates according to the right-hand
	 *     rule (counter-clockwise for exterior and clockwise for interior rings).
	 *     If `false`, coordinates will be oriented according to the left-hand rule
	 *     (clockwise for exterior and counter-clockwise for interior rings).
	 *     By default, coordinate orientation will depend on how the geometry was
	 *     constructed.
	 * @return {Array.<Array.<Array.<module:ol/coordinate~Coordinate>>>} Coordinates.
	 * @override
	 * @api
	 */
	public getCoordinates(opt_right?: boolean) {
		let flatCoordinates;
		if (opt_right !== undefined) {
			flatCoordinates = this.getOrientedFlatCoordinates().slice();
			orientLinearRingsArray(
				flatCoordinates, 0, this.endss, this.stride, opt_right);
		} else {
			flatCoordinates = this.flatCoordinates;
		}

		return inflateMultiCoordinatesArray(
			flatCoordinates, 0, this.endss, this.stride);
	}


	/**
	 * @return {Array.<Array.<number>>} Endss.
	 */
	public getEndss() {
		return this.endss;
	}


	/**
	 * @return {Array.<number>} Flat interior points.
	 */
	public getFlatInteriorPoints() {
		if (this.flatInteriorPointsRevision !== this.getRevision()) {
			const flatCenters = linearRingssCenter(
				this.flatCoordinates, 0, this.endss, this.stride);
			this.flatInteriorPoints = getInteriorPointsOfMultiArray(
				this.getOrientedFlatCoordinates(), 0, this.endss, this.stride,
				flatCenters);
			this.flatInteriorPointsRevision = this.getRevision();
		}
		return this.flatInteriorPoints;
	}


	/**
	 * Return the interior points as {@link module:ol/geom/MultiPoint multipoint}.
	 * @return {module:ol/geom/MultiPoint} Interior points as XYM coordinates, where M is
	 * the length of the horizontal intersection that the point belongs to.
	 * @api
	 */
	public getInteriorPoints() {
		const interiorPoints = new MultiPoint(null);
		interiorPoints.setFlatCoordinates(GeometryLayout.XYM,
			this.getFlatInteriorPoints().slice());
		return interiorPoints;
	}


	/**
	 * @return {Array.<number>} Oriented flat coordinates.
	 */
	public getOrientedFlatCoordinates() {
		if (this.orientedRevision !== this.getRevision()) {
			const flatCoordinates = this.flatCoordinates;
			if (linearRingsAreOriented(
				flatCoordinates, 0, this.endss, this.stride)) {
				this.orientedFlatCoordinates = flatCoordinates;
			} else {
				this.orientedFlatCoordinates = flatCoordinates.slice();
				this.orientedFlatCoordinates.length =
					orientLinearRingsArray(
						this.orientedFlatCoordinates, 0, this.endss, this.stride);
			}
			this.orientedRevision = this.getRevision();
		}
		return this.orientedFlatCoordinates;
	}


	/**
	 * @inheritDoc
	 */
	public getSimplifiedGeometryInternal(squaredTolerance: number) {
		const simplifiedFlatCoordinates = [] as number[];
		const simplifiedEndss = [] as number[][];
		simplifiedFlatCoordinates.length = quantizeMultiArray(
			this.flatCoordinates, 0, this.endss, this.stride,
			Math.sqrt(squaredTolerance),
			simplifiedFlatCoordinates, 0, simplifiedEndss);
		const simplifiedMultiPolygon = new MultiPolygon(null);
		simplifiedMultiPolygon.setFlatCoordinates(
			GeometryLayout.XY, simplifiedFlatCoordinates, simplifiedEndss);
		return simplifiedMultiPolygon;
	}


	/**
	 * Return the polygon at the specified index.
	 * @param {number} index Index.
	 * @return {module:ol/geom/Polygon} Polygon.
	 * @api
	 */
	public getPolygon(index: number) {
		if (index < 0 || this.endss.length <= index) {
			return null;
		}
		let offset;
		if (index === 0) {
			offset = 0;
		} else {
			const prevEnds = this.endss[index - 1];
			offset = prevEnds[prevEnds.length - 1];
		}
		const ends = this.endss[index].slice();
		const end = ends[ends.length - 1];
		if (offset !== 0) {
			for (let i = 0, ii = ends.length; i < ii; ++i) {
				ends[i] -= offset;
			}
		}
		const polygon = new Polygon(null);
		polygon.setFlatCoordinates(
			this.layout, this.flatCoordinates.slice(offset, end), ends);
		return polygon;
	}


	/**
	 * Return the polygons of this multipolygon.
	 * @return {Array.<module:ol/geom/Polygon>} Polygons.
	 * @api
	 */
	public getPolygons() {
		const layout = this.layout;
		const flatCoordinates = this.flatCoordinates;
		const endss = this.endss;
		const polygons = [];
		let offset = 0;
		for (let i = 0, ii = endss.length; i < ii; ++i) {
			const ends = endss[i].slice();
			const end = ends[ends.length - 1];
			if (offset !== 0) {
				for (let j = 0, jj = ends.length; j < jj; ++j) {
					ends[j] -= offset;
				}
			}
			const polygon = new Polygon(null);
			polygon.setFlatCoordinates(
				layout, flatCoordinates.slice(offset, end), ends);
			polygons.push(polygon);
			offset = end;
		}
		return polygons;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getType() {
		return GeometryType.MULTI_POLYGON;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public intersectsExtent(extent: Extent) {
		return intersectsLinearRingMultiArray(
			this.getOrientedFlatCoordinates(), 0, this.endss, this.stride, extent);
	}


	/**
	 * Set the coordinates of the multipolygon.
	 * @param {Array.<Array.<Array.<module:ol/coordinate~Coordinate>>>} coordinates Coordinates.
	 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
	 * @override
	 * @api
	 */
	public setCoordinates(coordinates: Coordinate[][][] | null, opt_layout?: GeometryLayout) {
		if (!coordinates) {
			this.setFlatCoordinates(GeometryLayout.XY, null, this.endss);
		} else {
			this.setLayout(opt_layout, coordinates, 3);
			if (!this.flatCoordinates) {
				this.flatCoordinates = [];
			}
			const endss = deflateMultiCoordinatesArray(
				this.flatCoordinates, 0, coordinates, this.stride, this.endss);
			if (endss.length === 0) {
				this.flatCoordinates.length = 0;
			} else {
				const lastEnds = endss[endss.length - 1];
				this.flatCoordinates.length = lastEnds.length === 0 ?
					0 : lastEnds[lastEnds.length - 1];
			}
			this.changed();
		}
	}


	/**
	 * @param {module:ol/geom/GeometryLayout} layout Layout.
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {Array.<Array.<number>>} endss Endss.
	 */
	public setFlatCoordinates(layout: GeometryLayout, flatCoordinates: number[] | null, endss: number[][]) {
		this.setFlatCoordinatesInternal(layout, flatCoordinates);
		this.endss = endss;
		this.changed();
	}


	/**
	 * @param {Array.<module:ol/geom/Polygon>} polygons Polygons.
	 */
	public setPolygons(polygons: Polygon[]) {
		let layout = this.getLayout();
		const flatCoordinates = [] as number[];
		const endss = [];
		for (let i = 0, ii = polygons.length; i < ii; ++i) {
			const polygon = polygons[i];
			if (i === 0) {
				layout = polygon.getLayout();
			}
			const offset = flatCoordinates.length;
			const ends = polygon.getEnds();
			for (let j = 0, jj = ends.length; j < jj; ++j) {
				ends[j] += offset;
			}
			extend(flatCoordinates, polygon.getFlatCoordinates());
			endss.push(ends);
		}
		this.setFlatCoordinates(layout, flatCoordinates, endss);
	}

}
