/**
 * @module ol/render/Feature
 */
import { extend } from '../array';
import { Coordinate } from '../coordinate';
import { createOrUpdateFromCoordinate, createOrUpdateFromFlatCoordinates, Extent, getCenter, getHeight } from '../extent';
import { linearRingss as linearRingssCenter } from '../geom/flat/center';
import { getInteriorPointOfArray, getInteriorPointsOfMultiArray } from '../geom/flat/interiorpoint';
import { interpolatePoint } from '../geom/flat/interpolate';
import { transform2D } from '../geom/flat/transform';
import GeometryType from '../geom/GeometryType';
import { get as getProjection, ProjectionLike } from '../proj';
import { compose as composeTransform, create as createTransform } from '../transform';

/**
 * @type {module:ol/transform~Transform}
 */
const tmpTransform = createTransform();

/**
 * Lightweight, read-only, {@link module:ol/Feature~Feature} and {@link module:ol/geom/Geometry~Geometry} like
 * structure, optimized for vector tile rendering and styling. Geometry access
 * through the API is limited to getting the type and extent of the geometry.
 *
 * @constructor
 * @param {module:ol/geom/GeometryType} type Geometry type.
 * @param {Array.<number>} flatCoordinates Flat coordinates. These always need
 *     to be right-handed for polygons.
 * @param {Array.<number>|Array.<Array.<number>>} ends Ends or Endss.
 * @param {Object.<string, *>} properties Properties.
 * @param {number|string|undefined} id Feature id.
 */
export default class RenderFeature {
	/**
	 * @private
	 * @type {module:ol/extent~Extent|undefined}
	 */
	private extent: Extent | undefined;

	/**
	 * @private
	 * @type {Array.<number>}
	 */
	private flatInteriorPoints: number[] | null = null;

	/**
	 * @private
	 * @type {Array.<number>}
	 */
	private flatMidpoints: number[] | null = null;
	private id: string | number | undefined;
	private type: GeometryType;
	private flatCoordinates: number[];
	private ends: number[] | number[][];
	private properties: { [s: string]: any; };
	constructor(type: GeometryType, flatCoordinates: number[], ends: number[] | number[][], properties: { [s: string]: any; }, id?: number | string) {
		/**
		 * @private
		 * @type {number|string|undefined}
		 */
		this.id = id;

		/**
		 * @private
		 * @type {module:ol/geom/GeometryType}
		 */
		this.type = type;

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.flatCoordinates = flatCoordinates;

		/**
		 * @private
		 * @type {Array.<number>|Array.<Array.<number>>}
		 */
		this.ends = ends;

		/**
		 * @private
		 * @type {Object.<string, *>}
		 */
		this.properties = properties;

	}

	/**
	 * Get a feature property by its key.
	 * @param {string} key Key
	 * @return {*} Value for the requested key.
	 * @api
	 */
	public get(key: string) {
		return this.properties[key];
	}


	/**
	 * @return {Array.<number>|Array.<Array.<number>>} Ends or endss.
	 */
	public getEnds() {
		return this.getEndss();
	}
	public getEndss() {
		return this.ends;
	}


	/**
	 * Get the extent of this feature's geometry.
	 * @return {module:ol/extent~Extent} Extent.
	 * @api
	 */
	public getExtent() {
		if (!this.extent) {
			this.extent = this.type === GeometryType.POINT ?
				createOrUpdateFromCoordinate(this.flatCoordinates as Coordinate) :
				createOrUpdateFromFlatCoordinates(
					this.flatCoordinates, 0, this.flatCoordinates.length, 2);

		}
		return this.extent;
	}


	/**
	 * @return {Array.<number>} Flat interior points.
	 */
	public getFlatInteriorPoint() {
		if (!this.flatInteriorPoints) {
			const flatCenter = getCenter(this.getExtent());
			this.flatInteriorPoints = getInteriorPointOfArray(
				this.flatCoordinates, 0, this.ends as number[], 2, flatCenter, 0);
		}
		return this.flatInteriorPoints;
	}


	/**
	 * @return {Array.<number>} Flat interior points.
	 */
	public getFlatInteriorPoints() {
		if (!this.flatInteriorPoints) {
			const flatCenters = linearRingssCenter(
				this.flatCoordinates, 0, this.ends as number[][], 2);
			this.flatInteriorPoints = getInteriorPointsOfMultiArray(
				this.flatCoordinates, 0, this.ends as number[][], 2, flatCenters);
		}
		return this.flatInteriorPoints;
	}


	/**
	 * @return {Array.<number>} Flat midpoint.
	 */
	public getFlatMidpoint() {
		if (!this.flatMidpoints) {
			this.flatMidpoints = interpolatePoint(
				this.flatCoordinates, 0, this.flatCoordinates.length, 2, 0.5);
		}
		return this.flatMidpoints;
	}


	/**
	 * @return {Array.<number>} Flat midpoints.
	 */
	public getFlatMidpoints() {
		if (!this.flatMidpoints) {
			this.flatMidpoints = [];
			const flatCoordinates = this.flatCoordinates;
			let offset = 0;
			const ends = this.ends as number[];
			for (let i = 0, ii = ends.length; i < ii; ++i) {
				const end = ends[i];
				const midpoint = interpolatePoint(
					flatCoordinates, offset, end, 2, 0.5);
				extend(this.flatMidpoints, midpoint);
				offset = end;
			}
		}
		return this.flatMidpoints;
	}

	/**
	 * Get the feature identifier.  This is a stable identifier for the feature and
	 * is set when reading data from a remote source.
	 * @return {number|string|undefined} Id.
	 * @api
	 */
	public getId() {
		return this.id;
	}


	/**
	 * @return {Array.<number>} Flat coordinates.
	 */
	public getOrientedFlatCoordinates() {
		return this.flatCoordinates;
	}


	/**
	 * @return {Array.<number>} Flat coordinates.
	 */
	public getFlatCoordinates() {
		return this.getOrientedFlatCoordinates();
	}

	/**
	 * For API compatibility with {@link module:ol/Feature~Feature}, this method is useful when
	 * determining the geometry type in style function (see {@link #getType}).
	 * @return {module:ol/render/Feature} Feature.
	 * @api
	 */
	public getGeometry() {
		return this as RenderFeature;
	}


	/**
	 * Get the feature properties.
	 * @return {Object.<string, *>} Feature properties.
	 * @api
	 */
	public getProperties() {
		return this.properties;
	}


	/**
	 * Get the feature for working with its geometry.
	 * @return {module:ol/render/Feature} Feature.
	 */
	public getSimplifiedGeometry() {
		return this.getGeometry();
	}


	/**
	 * @return {number} Stride.
	 */
	public getStride() {
		return 2;
	}


	/**
	 * @return {undefined}
	 */
	public getStyleFunction() { }


	/**
	 * Get the type of this feature's geometry.
	 * @return {module:ol/geom/GeometryType} Geometry type.
	 * @api
	 */
	public getType() {
		return this.type;
	}

	/**
	 * Transform geometry coordinates from tile pixel space to projected.
	 * The SRS of the source and destination are expected to be the same.
	 *
	 * @param {module:ol/proj~ProjectionLike} source The current projection
	 * @param {module:ol/proj~ProjectionLike} destination The desired projection.
	 */
	public transform(src: ProjectionLike, _destination: ProjectionLike) {
		const source = getProjection(src)!;
		const pixelExtent = source.getExtent()!;
		const projectedExtent = source.getWorldExtent()!;
		const scale = getHeight(projectedExtent) / getHeight(pixelExtent);
		composeTransform(tmpTransform,
			projectedExtent[0], projectedExtent[3],
			scale, -scale, 0,
			0, 0);
		transform2D(this.flatCoordinates, 0, this.flatCoordinates.length, 2,
			tmpTransform, this.flatCoordinates);
	}
}
