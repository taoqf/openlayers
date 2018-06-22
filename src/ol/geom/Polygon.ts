/**
 * @module ol/geom/Polygon
 */
import { extend } from '../array';
import { Coordinate } from '../coordinate';
import { closestSquaredDistanceXY, Extent, getCenter } from '../extent';
import { linearRings as linearRingsArea } from '../geom/flat/area';
import { arrayMaxSquaredDelta, assignClosestArrayPoint } from '../geom/flat/closest';
import { linearRingsContainsXY } from '../geom/flat/contains';
import { deflateCoordinatesArray } from '../geom/flat/deflate';
import { inflateCoordinatesArray } from '../geom/flat/inflate';
import { getInteriorPointOfArray } from '../geom/flat/interiorpoint';
import { intersectsLinearRingArray } from '../geom/flat/intersectsextent';
import { linearRingIsOriented, orientLinearRings } from '../geom/flat/orient';
import { quantizeArray } from '../geom/flat/simplify';
import GeometryLayout from '../geom/GeometryLayout';
import GeometryType from '../geom/GeometryType';
import LinearRing from '../geom/LinearRing';
import Point from '../geom/Point';
import SimpleGeometry from '../geom/SimpleGeometry';
import { modulo } from '../math';
import { offset as sphereOffset } from '../sphere';
import Circle from './Circle';

/**
 * @classdesc
 * Polygon geometry.
 *
 * @constructor
 * @extends {module:ol/geom/SimpleGeometry}
 * @param {Array.<Array.<module:ol/coordinate~Coordinate>>} coordinates Array of linear
 *     rings that define the polygon. The first linear ring of the array
 *     defines the outer-boundary or surface of the polygon. Each subsequent
 *     linear ring defines a hole in the surface of the polygon. A linear ring
 *     is an array of vertices' coordinates where the first coordinate and the
 *     last are equivalent.
 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
 * @api
 */
export default class Polygon extends SimpleGeometry {
	/**
	 * @type {Array.<number>}
	 * @private
	 */
	private ends: number[] = [];

	/**
	 * @private
	 * @type {number}
	 */
	private flatInteriorPointRevision = -1;

	/**
	 * @private
	 * @type {module:ol/coordinate~Coordinate}
	 */
	private flatInteriorPoint: Coordinate = null!;

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

	constructor(coordinates: Coordinate[][] | null, opt_layout?: GeometryLayout) {
		super();
		this.setCoordinates(coordinates, opt_layout);
	}

	/**
	 * Append the passed linear ring to this polygon.
	 * @param {module:ol/geom/LinearRing} linearRing Linear ring.
	 * @api
	 */
	public appendLinearRing(linearRing: LinearRing) {
		if (!this.flatCoordinates) {
			this.flatCoordinates = linearRing.getFlatCoordinates().slice();
		} else {
			extend(this.flatCoordinates, linearRing.getFlatCoordinates());
		}
		this.ends.push(this.flatCoordinates.length);
		this.changed();
	}


	/**
	 * Make a complete copy of the geometry.
	 * @return {!module:ol/geom/Polygon} Clone.
	 * @override
	 * @api
	 */
	public clone() {
		const polygon = new Polygon(null);
		polygon.setFlatCoordinates(
			this.layout, this.flatCoordinates.slice(), this.ends.slice());
		return polygon;
	}


	/**
	 * @inheritDoc
	 */
	public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number) {
		if (minSquaredDistance < closestSquaredDistanceXY(this.getExtent(), x, y)) {
			return minSquaredDistance;
		}
		if (this.maxDeltaRevision !== this.getRevision()) {
			this.maxDelta = Math.sqrt(arrayMaxSquaredDelta(
				this.flatCoordinates, 0, this.ends, this.stride, 0));
			this.maxDeltaRevision = this.getRevision();
		}
		return assignClosestArrayPoint(
			this.flatCoordinates, 0, this.ends, this.stride,
			this.maxDelta, true, x, y, closestPoint, minSquaredDistance);
	}


	/**
	 * @inheritDoc
	 */
	public containsXY(x: number, y: number) {
		return linearRingsContainsXY(this.getOrientedFlatCoordinates(), 0, this.ends, this.stride, x, y);
	}


	/**
	 * Return the area of the polygon on projected plane.
	 * @return {number} Area (on projected plane).
	 * @api
	 */
	public getArea() {
		return linearRingsArea(this.getOrientedFlatCoordinates(), 0, this.ends, this.stride);
	}


	/**
	 * Get the coordinate array for this geometry.  This array has the structure
	 * of a GeoJSON coordinate array for polygons.
	 *
	 * @param {boolean=} opt_right Orient coordinates according to the right-hand
	 *     rule (counter-clockwise for exterior and clockwise for interior rings).
	 *     If `false`, coordinates will be oriented according to the left-hand rule
	 *     (clockwise for exterior and counter-clockwise for interior rings).
	 *     By default, coordinate orientation will depend on how the geometry was
	 *     constructed.
	 * @return {Array.<Array.<module:ol/coordinate~Coordinate>>} Coordinates.
	 * @override
	 * @api
	 */
	public getCoordinates(opt_right?: boolean) {
		let flatCoordinates;
		if (opt_right !== undefined) {
			flatCoordinates = this.getOrientedFlatCoordinates().slice();
			orientLinearRings(
				flatCoordinates, 0, this.ends, this.stride, opt_right);
		} else {
			flatCoordinates = this.flatCoordinates;
		}

		return inflateCoordinatesArray(
			flatCoordinates, 0, this.ends, this.stride);
	}


	/**
	 * @return {Array.<number>} Ends.
	 */
	public getEnds() {
		return this.ends;
	}


	/**
	 * @return {Array.<number>} Interior point.
	 */
	public getFlatInteriorPoint() {
		if (this.flatInteriorPointRevision !== this.getRevision()) {
			const flatCenter = getCenter(this.getExtent());
			this.flatInteriorPoint = getInteriorPointOfArray(
				this.getOrientedFlatCoordinates(), 0, this.ends, this.stride,
				flatCenter, 0) as Coordinate;
			this.flatInteriorPointRevision = this.getRevision();
		}
		return this.flatInteriorPoint;
	}


	/**
	 * Return an interior point of the polygon.
	 * @return {module:ol/geom/Point} Interior point as XYM coordinate, where M is the
	 * length of the horizontal intersection that the point belongs to.
	 * @api
	 */
	public getInteriorPoint() {
		return new Point(this.getFlatInteriorPoint(), GeometryLayout.XYM);
	}


	/**
	 * Return the number of rings of the polygon,  this includes the exterior
	 * ring and any interior rings.
	 *
	 * @return {number} Number of rings.
	 * @api
	 */
	public getLinearRingCount() {
		return this.ends.length;
	}


	/**
	 * Return the Nth linear ring of the polygon geometry. Return `null` if the
	 * given index is out of range.
	 * The exterior linear ring is available at index `0` and the interior rings
	 * at index `1` and beyond.
	 *
	 * @param {number} index Index.
	 * @return {module:ol/geom/LinearRing} Linear ring.
	 * @api
	 */
	public getLinearRing(index: number) {
		if (index < 0 || this.ends.length <= index) {
			return null;
		}
		const linearRing = new LinearRing(null);
		linearRing.setFlatCoordinates(this.layout, this.flatCoordinates.slice(
			index === 0 ? 0 : this.ends[index - 1], this.ends[index]));
		return linearRing;
	}


	/**
	 * Return the linear rings of the polygon.
	 * @return {Array.<module:ol/geom/LinearRing>} Linear rings.
	 * @api
	 */
	public getLinearRings() {
		const layout = this.layout;
		const flatCoordinates = this.flatCoordinates;
		const ends = this.ends;
		const linearRings = [];
		let offset = 0;
		for (let i = 0, ii = ends.length; i < ii; ++i) {
			const end = ends[i];
			const linearRing = new LinearRing(null);
			linearRing.setFlatCoordinates(layout, flatCoordinates.slice(offset, end));
			linearRings.push(linearRing);
			offset = end;
		}
		return linearRings;
	}


	/**
	 * @return {Array.<number>} Oriented flat coordinates.
	 */
	public getOrientedFlatCoordinates() {
		if (this.orientedRevision !== this.getRevision()) {
			const flatCoordinates = this.flatCoordinates;
			if (linearRingIsOriented(
				flatCoordinates, 0, this.ends, this.stride)) {
				this.orientedFlatCoordinates = flatCoordinates;
			} else {
				this.orientedFlatCoordinates = flatCoordinates.slice();
				this.orientedFlatCoordinates.length =
					orientLinearRings(
						this.orientedFlatCoordinates, 0, this.ends, this.stride);
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
		const simplifiedEnds = [] as number[];
		simplifiedFlatCoordinates.length = quantizeArray(
			this.flatCoordinates, 0, this.ends, this.stride,
			Math.sqrt(squaredTolerance),
			simplifiedFlatCoordinates, 0, simplifiedEnds);
		const simplifiedPolygon = new Polygon(null);
		simplifiedPolygon.setFlatCoordinates(
			GeometryLayout.XY, simplifiedFlatCoordinates, simplifiedEnds);
		return simplifiedPolygon;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getType() {
		return GeometryType.POLYGON;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public intersectsExtent(extent: Extent) {
		return intersectsLinearRingArray(
			this.getOrientedFlatCoordinates(), 0, this.ends, this.stride, extent);
	}


	/**
	 * Set the coordinates of the polygon.
	 * @param {Array.<Array.<module:ol/coordinate~Coordinate>>} coordinates Coordinates.
	 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
	 * @override
	 * @api
	 */
	public setCoordinates(coordinates: Coordinate[][] | null, opt_layout?: GeometryLayout) {
		if (!coordinates) {
			this.setFlatCoordinates(GeometryLayout.XY, null, this.ends);
		} else {
			this.setLayout(opt_layout, coordinates, 2);
			if (!this.flatCoordinates) {
				this.flatCoordinates = [];
			}
			const ends = deflateCoordinatesArray(
				this.flatCoordinates, 0, coordinates, this.stride, this.ends);
			this.flatCoordinates.length = ends.length === 0 ? 0 : ends[ends.length - 1];
			this.changed();
		}
	}


	/**
	 * @param {module:ol/geom/GeometryLayout} layout Layout.
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {Array.<number>} ends Ends.
	 */
	public setFlatCoordinates(layout: GeometryLayout, flatCoordinates: number[] | null, ends: number[]) {
		this.setFlatCoordinatesInternal(layout, flatCoordinates);
		this.ends = ends;
		this.changed();
	}
}


/**
 * Create an approximation of a circle on the surface of a sphere.
 * @param {module:ol/coordinate~Coordinate} center Center (`[lon, lat]` in degrees).
 * @param {number} radius The great-circle distance from the center to
 *     the polygon vertices.
 * @param {number=} opt_n Optional number of vertices for the resulting
 *     polygon. Default is `32`.
 * @param {number=} opt_sphereRadius Optional radius for the sphere (defaults to
 *     the Earth's mean radius using the WGS84 ellipsoid).
 * @return {module:ol/geom/Polygon} The "circular" polygon.
 * @api
 */
export function circular(center: Coordinate, radius: number, opt_n?: number, opt_sphereRadius?: number) {
	const n = opt_n ? opt_n : 32;
	/** @type {Array.<number>} */
	const flatCoordinates = [] as number[];
	for (let i = 0; i < n; ++i) {
		extend(flatCoordinates, sphereOffset(center, radius, 2 * Math.PI * i / n, opt_sphereRadius));
	}
	flatCoordinates.push(flatCoordinates[0], flatCoordinates[1]);
	const polygon = new Polygon(null);
	polygon.setFlatCoordinates(GeometryLayout.XY, flatCoordinates, [flatCoordinates.length]);
	return polygon;
}


/**
 * Create a polygon from an extent. The layout used is `XY`.
 * @param {module:ol/extent~Extent} extent The extent.
 * @return {module:ol/geom/Polygon} The polygon.
 * @api
 */
export function fromExtent(extent: Extent) {
	const minX = extent[0];
	const minY = extent[1];
	const maxX = extent[2];
	const maxY = extent[3];
	const flatCoordinates =
		[minX, minY, minX, maxY, maxX, maxY, maxX, minY, minX, minY];
	const polygon = new Polygon(null);
	polygon.setFlatCoordinates(
		GeometryLayout.XY, flatCoordinates, [flatCoordinates.length]);
	return polygon;
}


/**
 * Create a regular polygon from a circle.
 * @param {module:ol/geom/Circle} circle Circle geometry.
 * @param {number=} opt_sides Number of sides of the polygon. Default is 32.
 * @param {number=} opt_angle Start angle for the first vertex of the polygon in
 *     radians. Default is 0.
 * @return {module:ol/geom/Polygon} Polygon geometry.
 * @api
 */
export function fromCircle(circle: Circle, opt_sides?: number, opt_angle?: number) {
	const sides = opt_sides ? opt_sides : 32;
	const stride = circle.getStride();
	const layout = circle.getLayout();
	const polygon = new Polygon(null, layout);
	const arrayLength = stride * (sides + 1);
	const flatCoordinates = new Array(arrayLength);
	for (let i = 0; i < arrayLength; i++) {
		flatCoordinates[i] = 0;
	}
	const ends = [flatCoordinates.length];
	polygon.setFlatCoordinates(layout, flatCoordinates, ends);
	makeRegular(polygon, circle.getCenter(), circle.getRadius(), opt_angle);
	return polygon;
}


/**
 * Modify the coordinates of a polygon to make it a regular polygon.
 * @param {module:ol/geom/Polygon} polygon Polygon geometry.
 * @param {module:ol/coordinate~Coordinate} center Center of the regular polygon.
 * @param {number} radius Radius of the regular polygon.
 * @param {number=} opt_angle Start angle for the first vertex of the polygon in
 *     radians. Default is 0.
 */
export function makeRegular(polygon: Polygon, center: Coordinate, radius: number, opt_angle?: number) {
	const flatCoordinates = polygon.getFlatCoordinates();
	const layout = polygon.getLayout();
	const stride = polygon.getStride();
	const ends = polygon.getEnds();
	const sides = flatCoordinates.length / stride - 1;
	const startAngle = opt_angle ? opt_angle : 0;
	for (let i = 0; i <= sides; ++i) {
		const offset = i * stride;
		const angle = startAngle + (modulo(i, sides) * 2 * Math.PI / sides);
		flatCoordinates[offset] = center[0] + (radius * Math.cos(angle));
		flatCoordinates[offset + 1] = center[1] + (radius * Math.sin(angle));
	}
	polygon.setFlatCoordinates(layout, flatCoordinates, ends);
}
