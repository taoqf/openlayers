/**
 * @module ol/geom/MultiLineString
 */
import { extend } from '../array';
import { Coordinate } from '../coordinate';
import { closestSquaredDistanceXY, Extent } from '../extent';
import { arrayMaxSquaredDelta, assignClosestArrayPoint } from '../geom/flat/closest';
import { deflateCoordinatesArray } from '../geom/flat/deflate';
import { inflateCoordinatesArray } from '../geom/flat/inflate';
import { interpolatePoint, lineStringsCoordinateAtM } from '../geom/flat/interpolate';
import { intersectsLineStringArray } from '../geom/flat/intersectsextent';
import { douglasPeuckerArray } from '../geom/flat/simplify';
import GeometryLayout from '../geom/GeometryLayout';
import GeometryType from '../geom/GeometryType';
import LineString from '../geom/LineString';
import SimpleGeometry from '../geom/SimpleGeometry';

/**
 * @classdesc
 * Multi-linestring geometry.
 *
 * @constructor
 * @extends {module:ol/geom/SimpleGeometry}
 * @param {Array.<Array.<module:ol/coordinate~Coordinate>>} coordinates Coordinates.
 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
 * @api
 */
export default class MultiLineString extends SimpleGeometry {

	/**
	 * @type {Array.<number>}
	 * @private
	 */
	private ends: number[] = [];

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

	constructor(coordinates: Coordinate[][] | null, opt_layout?: GeometryLayout) {
		super();
		this.setCoordinates(coordinates, opt_layout);

	}


	/**
	 * Append the passed linestring to the multilinestring.
	 * @param {module:ol/geom/LineString} lineString LineString.
	 * @api
	 */
	public appendLineString(lineString: LineString) {
		if (!this.flatCoordinates) {
			this.flatCoordinates = lineString.getFlatCoordinates().slice();
		} else {
			extend(this.flatCoordinates, lineString.getFlatCoordinates().slice());
		}
		this.ends.push(this.flatCoordinates.length);
		this.changed();
	}


	/**
	 * Make a complete copy of the geometry.
	 * @return {!module:ol/geom/MultiLineString} Clone.
	 * @override
	 * @api
	 */
	public clone() {
		const multiLineString = new MultiLineString(null!);
		multiLineString.setFlatCoordinates(
			this.layout, this.flatCoordinates.slice(), this.ends.slice());
		return multiLineString;
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
			this.maxDelta, false, x, y, closestPoint, minSquaredDistance);
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
	 * `opt_interpolate` controls interpolation between consecutive LineStrings
	 * within the MultiLineString. If `opt_interpolate` is `true` the coordinates
	 * will be linearly interpolated between the last coordinate of one LineString
	 * and the first coordinate of the next LineString.  If `opt_interpolate` is
	 * `false` then the function will return `null` for Ms falling between
	 * LineStrings.
	 *
	 * @param {number} m M.
	 * @param {boolean=} opt_extrapolate Extrapolate. Default is `false`.
	 * @param {boolean=} opt_interpolate Interpolate. Default is `false`.
	 * @return {module:ol/coordinate~Coordinate} Coordinate.
	 * @api
	 */
	public getCoordinateAtM(m: number, opt_extrapolate?: boolean, opt_interpolate?: boolean) {
		if ((this.layout !== GeometryLayout.XYM &&
			this.layout !== GeometryLayout.XYZM) ||
			this.flatCoordinates.length === 0) {
			return null;
		}
		const extrapolate = opt_extrapolate !== undefined ? opt_extrapolate : false;
		const interpolate = opt_interpolate !== undefined ? opt_interpolate : false;
		return lineStringsCoordinateAtM(this.flatCoordinates, 0,
			this.ends, this.stride, m, extrapolate, interpolate);
	}


	/**
	 * Return the coordinates of the multilinestring.
	 * @return {Array.<Array.<module:ol/coordinate~Coordinate>>} Coordinates.
	 * @override
	 * @api
	 */
	public getCoordinates() {
		return inflateCoordinatesArray(
			this.flatCoordinates, 0, this.ends, this.stride);
	}


	/**
	 * @return {Array.<number>} Ends.
	 */
	public getEnds() {
		return this.ends;
	}


	/**
	 * Return the linestring at the specified index.
	 * @param {number} index Index.
	 * @return {module:ol/geom/LineString} LineString.
	 * @api
	 */
	public getLineString(index: number) {
		if (index < 0 || this.ends.length <= index) {
			return null;
		}
		const lineString = new LineString(null!);
		lineString.setFlatCoordinates(this.layout, this.flatCoordinates.slice(
			index === 0 ? 0 : this.ends[index - 1], this.ends[index]));
		return lineString;
	}


	/**
	 * Return the linestrings of this multilinestring.
	 * @return {Array.<module:ol/geom/LineString>} LineStrings.
	 * @api
	 */
	public getLineStrings() {
		const flatCoordinates = this.flatCoordinates;
		const ends = this.ends;
		const layout = this.layout;
		/** @type {Array.<module:ol/geom/LineString>} */
		const lineStrings = [];
		let offset = 0;
		for (let i = 0, ii = ends.length; i < ii; ++i) {
			const end = ends[i];
			const lineString = new LineString(null!);
			lineString.setFlatCoordinates(layout, flatCoordinates.slice(offset, end));
			lineStrings.push(lineString);
			offset = end;
		}
		return lineStrings;
	}


	/**
	 * @return {Array.<number>} Flat midpoints.
	 */
	public getFlatMidpoints() {
		const midpoints = [] as number[];
		const flatCoordinates = this.flatCoordinates;
		let offset = 0;
		const ends = this.ends;
		const stride = this.stride;
		for (let i = 0, ii = ends.length; i < ii; ++i) {
			const end = ends[i];
			const midpoint = interpolatePoint(
				flatCoordinates, offset, end, stride, 0.5);
			extend(midpoints, midpoint);
			offset = end;
		}
		return midpoints;
	}


	/**
	 * @inheritDoc
	 */
	public getSimplifiedGeometryInternal(squaredTolerance: number) {
		const simplifiedFlatCoordinates = [] as number[];
		const simplifiedEnds = [] as number[];
		simplifiedFlatCoordinates.length = douglasPeuckerArray(
			this.flatCoordinates, 0, this.ends, this.stride, squaredTolerance,
			simplifiedFlatCoordinates, 0, simplifiedEnds);
		const simplifiedMultiLineString = new MultiLineString(null);
		simplifiedMultiLineString.setFlatCoordinates(
			GeometryLayout.XY, simplifiedFlatCoordinates, simplifiedEnds);
		return simplifiedMultiLineString;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getType() {
		return GeometryType.MULTI_LINE_STRING;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public intersectsExtent(extent: Extent) {
		return intersectsLineStringArray(
			this.flatCoordinates, 0, this.ends, this.stride, extent);
	}


	/**
	 * Set the coordinates of the multilinestring.
	 * @param {Array.<Array.<module:ol/coordinate~Coordinate>>} coordinates Coordinates.
	 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
	 * @override
	 * @api
	 */
	public setCoordinates(coordinates: Coordinate[][] | null, opt_layout?: GeometryLayout) {
		if (!coordinates) {
			this.setFlatCoordinates(GeometryLayout.XY, null!, this.ends);
		} else {
			this.setLayout(opt_layout, coordinates, 2);
			if (!this.flatCoordinates) {
				this.flatCoordinates = [];
			}
			const ends = deflateCoordinatesArray(
				this.flatCoordinates, 0, coordinates as Coordinate[][], this.stride, this.ends);
			this.flatCoordinates.length = ends.length === 0 ? 0 : ends[ends.length - 1];
			this.changed();
		}
	}


	/**
	 * @param {module:ol/geom/GeometryLayout} layout Layout.
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {Array.<number>} ends Ends.
	 */
	public setFlatCoordinates(layout: GeometryLayout, flatCoordinates: number[], ends: number[]) {
		this.setFlatCoordinatesInternal(layout, flatCoordinates);
		this.ends = ends;
		this.changed();
	}


	/**
	 * @param {Array.<module:ol/geom/LineString>} lineStrings LineStrings.
	 */
	public setLineStrings(lineStrings: LineString[]) {
		let layout = this.getLayout();
		const flatCoordinates = [] as number[];
		const ends = [];
		for (let i = 0, ii = lineStrings.length; i < ii; ++i) {
			const lineString = lineStrings[i];
			if (i === 0) {
				layout = lineString.getLayout();
			}
			extend(flatCoordinates, lineString.getFlatCoordinates());
			ends.push(flatCoordinates.length);
		}
		this.setFlatCoordinates(layout, flatCoordinates, ends);
	}
}
