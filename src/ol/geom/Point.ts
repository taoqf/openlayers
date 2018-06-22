/**
 * @module ol/geom/Point
 */
import { Coordinate } from '../coordinate';
import { containsXY, createOrUpdateFromCoordinate, Extent } from '../extent';
import { deflateCoordinate } from '../geom/flat/deflate';
import GeometryLayout from '../geom/GeometryLayout';
import GeometryType from '../geom/GeometryType';
import SimpleGeometry from '../geom/SimpleGeometry';
import { squaredDistance as squaredDx } from '../math';

/**
 * @classdesc
 * Point geometry.
 *
 * @constructor
 * @extends {module:ol/geom/SimpleGeometry}
 * @param {module:ol/coordinate~Coordinate} coordinates Coordinates.
 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
 * @api
 */
export default class Point extends SimpleGeometry {
	constructor(coordinates: Coordinate | null, opt_layout?: GeometryLayout) {
		super();
		this.setCoordinates(coordinates, opt_layout);
	}

	/**
	 * Make a complete copy of the geometry.
	 * @return {!module:ol/geom/Point} Clone.
	 * @override
	 * @api
	 */
	public clone() {
		const point = new Point(null);
		point.setFlatCoordinates(this.layout, this.flatCoordinates.slice());
		return point;
	}


	/**
	 * @inheritDoc
	 */
	public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number) {
		const flatCoordinates = this.flatCoordinates;
		const squaredDistance = squaredDx(x, y, flatCoordinates[0], flatCoordinates[1]);
		if (squaredDistance < minSquaredDistance) {
			const stride = this.stride;
			for (let i = 0; i < stride; ++i) {
				closestPoint[i] = flatCoordinates[i];
			}
			closestPoint.length = stride as 2;
			return squaredDistance;
		} else {
			return minSquaredDistance;
		}
	}


	/**
	 * Return the coordinate of the point.
	 * @return {module:ol/coordinate~Coordinate} Coordinates.
	 * @override
	 * @api
	 */
	public getCoordinates() {
		return !this.flatCoordinates ? [] as any as Coordinate : this.flatCoordinates.slice() as Coordinate;
	}


	/**
	 * @inheritDoc
	 */
	public computeExtent(extent: Extent) {
		return createOrUpdateFromCoordinate(this.flatCoordinates as Coordinate, extent);
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getType() {
		return GeometryType.POINT;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public intersectsExtent(extent: Extent) {
		return containsXY(extent, this.flatCoordinates[0], this.flatCoordinates[1]);
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public setCoordinates(coordinates: Coordinate | null, opt_layout?: GeometryLayout) {
		if (!coordinates) {
			this.setFlatCoordinates(GeometryLayout.XY, null);
		} else {
			this.setLayout(opt_layout, coordinates, 0);
			if (!this.flatCoordinates) {
				this.flatCoordinates = [];
			}
			this.flatCoordinates.length = deflateCoordinate(
				this.flatCoordinates, 0, coordinates, this.stride);
			this.changed();
		}
	}


	/**
	 * @param {module:ol/geom/GeometryLayout} layout Layout.
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 */
	public setFlatCoordinates(layout: GeometryLayout, flatCoordinates: number[] | null) {
		this.setFlatCoordinatesInternal(layout, flatCoordinates);
		this.changed();
	}
}
