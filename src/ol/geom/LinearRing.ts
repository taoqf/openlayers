/**
 * @module ol/geom/LinearRing
 */
import { Coordinate } from '../coordinate';
import { closestSquaredDistanceXY, Extent } from '../extent';
import { linearRing as linearRingArea } from '../geom/flat/area';
import { assignClosestPoint, maxSquaredDelta } from '../geom/flat/closest';
import { deflateCoordinates } from '../geom/flat/deflate';
import { inflateCoordinates } from '../geom/flat/inflate';
import { douglasPeucker } from '../geom/flat/simplify';
import GeometryLayout from '../geom/GeometryLayout';
import GeometryType from '../geom/GeometryType';
import SimpleGeometry from '../geom/SimpleGeometry';

/**
 * @classdesc
 * Linear ring geometry. Only used as part of polygon; cannot be rendered
 * on its own.
 *
 * @constructor
 * @extends {module:ol/geom/SimpleGeometry}
 * @param {Array.<module:ol/coordinate~Coordinate>} coordinates Coordinates.
 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
 * @api
 */
export default class LinearRing extends SimpleGeometry {

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
	 * Make a complete copy of the geometry.
	 * @return {!module:ol/geom/LinearRing} Clone.
	 * @override
	 * @api
	 */
	public clone() {
		const linearRing = new LinearRing(null!);
		linearRing.setFlatCoordinates(this.layout, this.flatCoordinates.slice());
		return linearRing;
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
			this.maxDelta, true, x, y, closestPoint, minSquaredDistance);
	}

	/**
	 * Return the area of the linear ring on projected plane.
	 * @return {number} Area (on projected plane).
	 * @api
	 */
	public getArea() {
		return linearRingArea(this.flatCoordinates, 0, this.flatCoordinates.length, this.stride);
	}


	/**
	 * Return the coordinates of the linear ring.
	 * @return {Array.<module:ol/coordinate~Coordinate>} Coordinates.
	 * @override
	 * @api
	 */
	public getCoordinates() {
		return inflateCoordinates(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride);
	}

	/**
	 * @inheritDoc
	 */
	public getSimplifiedGeometryInternal(squaredTolerance: number) {
		const simplifiedFlatCoordinates = [] as number[];
		simplifiedFlatCoordinates.length = douglasPeucker(
			this.flatCoordinates, 0, this.flatCoordinates.length, this.stride,
			squaredTolerance, simplifiedFlatCoordinates, 0);
		const simplifiedLinearRing = new LinearRing(null!);
		simplifiedLinearRing.setFlatCoordinates(
			GeometryLayout.XY, simplifiedFlatCoordinates);
		return simplifiedLinearRing;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getType() {
		return GeometryType.LINEAR_RING;
	}


	/**
	 * @inheritDoc
	 */
	public intersectsExtent(_extent: Extent) {
		return false;
	}


	/**
	 * Set the coordinates of the linear ring.
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
