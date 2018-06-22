/**
 * @module ol/geom/Geometry
 */
import { Coordinate } from '../coordinate';
import { createEmpty, Extent, getHeight, returnOrUpdate } from '../extent';
import { transform2D } from '../geom/flat/transform';
import BaseObject from '../Object';
import { get as getProjection, getTransform, ProjectionLike, TransformFunction } from '../proj';
import Units from '../proj/Units';
import { compose as composeTransform, create as createTransform } from '../transform';
import GeometryType from './GeometryType';


/**
 * @type {module:ol/transform~Transform}
 */
const tmpTransform = createTransform();


/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for vector geometries.
 *
 * To get notified of changes to the geometry, register a listener for the
 * generic `change` event on your geometry instance.
 *
 * @constructor
 * @abstract
 * @extends {module:ol/Object}
 * @api
 */
export default abstract class Geometry extends BaseObject {
	/**
	 * @protected
	 * @type {Object.<string, module:ol/geom/Geometry>}
	 */
	protected simplifiedGeometryCache = {} as { [s: string]: Geometry };

	/**
	 * @protected
	 * @type {number}
	 */
	protected simplifiedGeometryMaxMinSquaredTolerance = 0;

	/**
	 * @protected
	 * @type {number}
	 */
	protected simplifiedGeometryRevision = 0;

	/**
	 * @private
	 * @type {module:ol/extent~Extent}
	 */
	private extent = createEmpty();

	/**
	 * @private
	 * @type {number}
	 */
	private extentRevision = -1;

	/**
	 * Make a complete copy of the geometry.
	 * @abstract
	 * @return {!module:ol/geom/Geometry} Clone.
	 */
	public abstract clone(): Geometry;

	/**
	 * @abstract
	 * @param {number} x X.
	 * @param {number} y Y.
	 * @param {module:ol/coordinate~Coordinate} closestPoint Closest point.
	 * @param {number} minSquaredDistance Minimum squared distance.
	 * @return {number} Minimum squared distance.
	 */
	public abstract closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number): number;


	/**
	 * Return the closest point of the geometry to the passed point as
	 * {@link module:ol/coordinate~Coordinate coordinate}.
	 * @param {module:ol/coordinate~Coordinate} point Point.
	 * @param {module:ol/coordinate~Coordinate=} opt_closestPoint Closest point.
	 * @return {module:ol/coordinate~Coordinate} Closest point.
	 * @api
	 */
	public getClosestPoint(point: Coordinate, opt_closestPoint?: Coordinate) {
		const closestPoint = opt_closestPoint ? opt_closestPoint : [NaN, NaN] as Coordinate;
		this.closestPointXY(point[0], point[1], closestPoint, Infinity);
		return closestPoint;
	}


	/**
	 * Returns true if this geometry includes the specified coordinate. If the
	 * coordinate is on the boundary of the geometry, returns false.
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @return {boolean} Contains coordinate.
	 * @api
	 */
	public intersectsCoordinate(coordinate: Coordinate) {
		return this.containsXY(coordinate[0], coordinate[1]);
	}


	/**
	 * @abstract
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @protected
	 * @return {module:ol/extent~Extent} extent Extent.
	 */
	public abstract computeExtent(extent: Extent): Extent;


	/**
	 * @param {number} x X.
	 * @param {number} y Y.
	 * @return {boolean} Contains (x, y).
	 */
	public containsXY(_x: number, _y: number) {
		return false;
	}


	/**
	 * Get the extent of the geometry.
	 * @param {module:ol/extent~Extent=} opt_extent Extent.
	 * @return {module:ol/extent~Extent} extent Extent.
	 * @api
	 */
	public getExtent(opt_extent?: Extent) {
		if (this.extentRevision !== this.getRevision()) {
			this.extent = this.computeExtent(this.extent);
			this.extentRevision = this.getRevision();
		}
		return returnOrUpdate(this.extent, opt_extent);
	}


	/**
	 * Rotate the geometry around a given coordinate. This modifies the geometry
	 * coordinates in place.
	 * @abstract
	 * @param {number} angle Rotation angle in radians.
	 * @param {module:ol/coordinate~Coordinate} anchor The rotation center.
	 * @api
	 */
	public abstract rotate(angle: number, anchor: Coordinate): void;


	/**
	 * Scale the geometry (with an optional origin).  This modifies the geometry
	 * coordinates in place.
	 * @abstract
	 * @param {number} sx The scaling factor in the x-direction.
	 * @param {number=} opt_sy The scaling factor in the y-direction (defaults to
	 *     sx).
	 * @param {module:ol/coordinate~Coordinate=} opt_anchor The scale origin (defaults to the center
	 *     of the geometry extent).
	 * @api
	 */
	public abstract scale(sx: number, opt_sy?: number, opt_anchor?: Coordinate): void;


	/**
	 * Create a simplified version of this geometry.  For linestrings, this uses
	 * the the {@link
	 * https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm
	 * Douglas Peucker} algorithm.  For polygons, a quantization-based
	 * simplification is used to preserve topology.
	 * @function
	 * @param {number} tolerance The tolerance distance for simplification.
	 * @return {module:ol/geom/Geometry} A new, simplified version of the original
	 *     geometry.
	 * @api
	 */
	public simplify(tolerance: number) {
		return this.getSimplifiedGeometry(tolerance * tolerance);
	}


	/**
	 * Create a simplified version of this geometry using the Douglas Peucker
	 * algorithm.
	 * @see https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm
	 * @abstract
	 * @param {number} squaredTolerance Squared tolerance.
	 * @return {module:ol/geom/Geometry} Simplified geometry.
	 */
	public abstract getSimplifiedGeometry(squaredTolerance: number): Geometry;


	/**
	 * Get the type of this geometry.
	 * @abstract
	 * @return {module:ol/geom/GeometryType} Geometry type.
	 */
	public abstract getType(): GeometryType;


	/**
	 * Apply a transform function to each coordinate of the geometry.
	 * The geometry is modified in place.
	 * If you do not want the geometry modified in place, first `clone()` it and
	 * then use this function on the clone.
	 * @abstract
	 * @param {module:ol/proj~TransformFunction} transformFn Transform.
	 */
	public abstract applyTransform(transformFn: TransformFunction): void;


	/**
	 * Test if the geometry and the passed extent intersect.
	 * @abstract
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @return {boolean} `true` if the geometry and the extent intersect.
	 */
	public abstract intersectsExtent(extent: Extent): boolean;


	/**
	 * Translate the geometry.  This modifies the geometry coordinates in place.  If
	 * instead you want a new geometry, first `clone()` this geometry.
	 * @abstract
	 * @param {number} deltaX Delta X.
	 * @param {number} deltaY Delta Y.
	 */
	public abstract translate(deltaX: number, deltaY: number): void;


	/**
	 * Transform each coordinate of the geometry from one coordinate reference
	 * system to another. The geometry is modified in place.
	 * For example, a line will be transformed to a line and a circle to a circle.
	 * If you do not want the geometry modified in place, first `clone()` it and
	 * then use this function on the clone.
	 *
	 * @param {module:ol/proj~ProjectionLike} source The current projection.  Can be a
	 *     string identifier or a {@link module:ol/proj/Projection~Projection} object.
	 * @param {module:ol/proj~ProjectionLike} destination The desired projection.  Can be a
	 *     string identifier or a {@link module:ol/proj/Projection~Projection} object.
	 * @return {module:ol/geom/Geometry} This geometry.  Note that original geometry is
	 *     modified in place.
	 * @api
	 */
	public transform(src: ProjectionLike, destination: ProjectionLike) {
		const source = getProjection(src);
		const transformFn = source!.getUnits() === Units.TILE_PIXELS ?
			(inCoordinates: number[], outCoordinates: number[], stride: number) => {
				const pixelExtent = source!.getExtent();
				const projectedExtent = source!.getWorldExtent();
				const scale = getHeight(projectedExtent!) / getHeight(pixelExtent!);
				composeTransform(tmpTransform,
					projectedExtent![0], projectedExtent![3],
					scale, -scale, 0,
					0, 0);
				transform2D(inCoordinates, 0, inCoordinates.length, stride,
					tmpTransform, outCoordinates);
				return getTransform(source!, destination)(inCoordinates, outCoordinates, stride);
			} :
			getTransform(source!, destination);
		this.applyTransform(transformFn as any);
		return this;
	}
}

