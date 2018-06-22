/**
 * @module ol/geom/LineString
 */
import { extend } from '../array';
import { Coordinate } from '../coordinate';
import { closestSquaredDistanceXY, Extent } from '../extent';
import { assignClosestPoint, maxSquaredDelta } from '../geom/flat/closest';
import { deflateCoordinates } from '../geom/flat/deflate';
import { inflateCoordinates } from '../geom/flat/inflate';
import { interpolatePoint, lineStringCoordinateAtM } from '../geom/flat/interpolate';
import { intersectsLineString } from '../geom/flat/intersectsextent';
import { lineStringLength } from '../geom/flat/length';
import { forEach as forEachSegment } from '../geom/flat/segments';
import { douglasPeucker } from '../geom/flat/simplify';
import GeometryLayout from '../geom/GeometryLayout';
import GeometryType from '../geom/GeometryType';
import SimpleGeometry from '../geom/SimpleGeometry';

/**
 * @classdesc
 * Linestring geometry.
 *
 * @constructor
 * @extends {module:ol/geom/SimpleGeometry}
 * @param {Array.<module:ol/coordinate~Coordinate>} coordinates Coordinates.
 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
 * @api
 */
export default class LineString extends SimpleGeometry {
	/**
	 * @private
	 * @type {module:ol/coordinate~Coordinate}
	 */
	private flatMidpoint: Coordinate | null = null;

	/**
	 * @private
	 * @type {number}
	 */
	private flatMidpointRevision = -1;

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
	constructor(coordinates: Coordinate[] | null, opt_layout?: GeometryLayout) {

		super();


		this.setCoordinates(coordinates, opt_layout);

	}

	/**
	 * Append the passed coordinate to the coordinates of the linestring.
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @api
	 */
	public appendCoordinate(coordinate: Coordinate) {
		if (!this.flatCoordinates) {
			this.flatCoordinates = coordinate.slice();
		} else {
			extend(this.flatCoordinates, coordinate);
		}
		this.changed();
	}


	/**
	 * Make a complete copy of the geometry.
	 * @return {!module:ol/geom/LineString} Clone.
	 * @override
	 * @api
	 */
	public clone() {
		const lineString = new LineString(null!);
		lineString.setFlatCoordinates(this.layout, this.flatCoordinates.slice());
		return lineString;
	}


	/**
	 * @inheritDoc
	 */
	public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number) {
		if (minSquaredDistance < closestSquaredDistanceXY(this.getExtent(), x, y)) {
			return minSquaredDistance;
		}
		if (this.maxDeltaRevision !== this.getRevision()) {
			this.maxDelta = Math.sqrt(maxSquaredDelta(
				this.flatCoordinates, 0, this.flatCoordinates.length, this.stride, 0));
			this.maxDeltaRevision = this.getRevision();
		}
		return assignClosestPoint(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride,
			this.maxDelta, false, x, y, closestPoint, minSquaredDistance);
	}


	/**
	 * Iterate over each segment, calling the provided callback.
	 * If the callback returns a truthy value the function returns that
	 * value immediately. Otherwise the function returns `false`.
	 *
	 * @param {function(this: S, module:ol/coordinate~Coordinate, module:ol/coordinate~Coordinate): T} callback Function
	 *     called for each segment.
	 * @return {T|boolean} Value.
	 * @template T,S
	 * @api
	 */
	public forEachSegment<T, S>(callback: (this: S, a: Coordinate, b: Coordinate) => T) {
		return forEachSegment<T, S>(this.flatCoordinates, 0, this.flatCoordinates.length, this.stride, callback);
	}


	/**
	 * Returns the coordinate at `m` using linear interpolation, or `null` if no
	 * such coordinate exists.
	 *
	 * `opt_extrapolate` controls extrapolation beyond the range of Ms in the
	 * MultiLineString. If `opt_extrapolate` is `true` then Ms less than the first
	 * M will return the first coordinate and Ms greater than the last M will
	 * return the last coordinate.
	 *
	 * @param {number} m M.
	 * @param {boolean=} opt_extrapolate Extrapolate. Default is `false`.
	 * @return {module:ol/coordinate~Coordinate} Coordinate.
	 * @api
	 */
	public getCoordinateAtM(m: number, opt_extrapolate?: boolean) {
		if (this.layout !== GeometryLayout.XYM &&
			this.layout !== GeometryLayout.XYZM) {
			return null;
		}
		const extrapolate = opt_extrapolate !== undefined ? opt_extrapolate : false;
		return lineStringCoordinateAtM(this.flatCoordinates, 0,
			this.flatCoordinates.length, this.stride, m, extrapolate);
	}


	/**
	 * Return the coordinates of the linestring.
	 * @return {Array.<module:ol/coordinate~Coordinate>} Coordinates.
	 * @override
	 * @api
	 */
	public getCoordinates() {
		return inflateCoordinates(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride);
	}


	/**
	 * Return the coordinate at the provided fraction along the linestring.
	 * The `fraction` is a number between 0 and 1, where 0 is the start of the
	 * linestring and 1 is the end.
	 * @param {number} fraction Fraction.
	 * @param {module:ol/coordinate~Coordinate=} opt_dest Optional coordinate whose values will
	 *     be modified. If not provided, a new coordinate will be returned.
	 * @return {module:ol/coordinate~Coordinate} Coordinate of the interpolated point.
	 * @api
	 */
	public getCoordinateAt(fraction: number, opt_dest?: Coordinate) {
		return interpolatePoint(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride,
			fraction, opt_dest) as Coordinate;
	}

	/**
	 * Return the length of the linestring on projected plane.
	 * @return {number} Length (on projected plane).
	 * @api
	 */
	public getLength() {
		return lineStringLength(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride);
	}


	/**
	 * @return {Array.<number>} Flat midpoint.
	 */
	public getFlatMidpoint() {
		if (this.flatMidpointRevision !== this.getRevision()) {
			this.flatMidpoint = this.getCoordinateAt(0.5, this.flatMidpoint!);
			this.flatMidpointRevision = this.getRevision();
		}
		return this.flatMidpoint;
	}


	/**
	 * @inheritDoc
	 */
	public getSimplifiedGeometryInternal(squaredTolerance: number) {
		const simplifiedFlatCoordinates = [] as number[];
		simplifiedFlatCoordinates.length = douglasPeucker(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride,
			squaredTolerance, simplifiedFlatCoordinates, 0);
		const simplifiedLineString = new LineString(null!);
		simplifiedLineString.setFlatCoordinates(
			GeometryLayout.XY, simplifiedFlatCoordinates);
		return simplifiedLineString;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getType() {
		return GeometryType.LINE_STRING;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public intersectsExtent(extent: Extent) {
		return intersectsLineString(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride,
			extent);
	}


	/**
	 * Set the coordinates of the linestring.
	 * @param {Array.<module:ol/coordinate~Coordinate>} coordinates Coordinates.
	 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
	 * @override
	 * @api
	 */
	public setCoordinates(coordinates: Coordinate[] | null, opt_layout?: GeometryLayout) {
		if (!coordinates) {
			this.setFlatCoordinates(GeometryLayout.XY, null!);
		} else {
			this.setLayout(opt_layout, coordinates, 1);
			if (!this.flatCoordinates) {
				this.flatCoordinates = [];
			}
			this.flatCoordinates.length = deflateCoordinates(
				this.flatCoordinates, 0, coordinates, this.stride);
			this.changed();
		}
	}


	/**
	 * @param {module:ol/geom/GeometryLayout} layout Layout.
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 */
	public setFlatCoordinates(layout: GeometryLayout, flatCoordinates: number[]) {
		this.setFlatCoordinatesInternal(layout, flatCoordinates);
		this.changed();
	}
}
