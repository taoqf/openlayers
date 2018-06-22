/**
 * @module ol/geom/GeometryCollection
 */
import { Coordinate } from '../coordinate';
import { listen, unlisten } from '../events';
import EventType from '../events/EventType';
import { closestSquaredDistanceXY, createOrUpdateEmpty, extend, Extent, getCenter } from '../extent';
import Geometry from '../geom/Geometry';
import GeometryType from '../geom/GeometryType';
import { clear } from '../obj';
import { TransformFunction } from '../proj';
import SimpleGeometry from './SimpleGeometry';

/**
 * @classdesc
 * An array of {@link module:ol/geom/Geometry} objects.
 *
 * @constructor
 * @extends {module:ol/geom/Geometry}
 * @param {Array.<module:ol/geom/Geometry>=} opt_geometries Geometries.
 * @api
 */
export default class GeometryCollection extends Geometry {
	private geometries: Geometry[] | null;
	constructor(opt_geometries?: Geometry[]) {

		super();

		/**
		 * @private
		 * @type {Array.<module:ol/geom/Geometry>}
		 */
		this.geometries = opt_geometries ? opt_geometries : null;

		this.listenGeometriesChange_();
	}


	/**
	 * Make a complete copy of the geometry.
	 * @return {!module:ol/geom/GeometryCollection} Clone.
	 * @override
	 * @api
	 */
	public clone() {
		const geometryCollection = new GeometryCollection(null!);
		geometryCollection.setGeometries(this.geometries!);
		return geometryCollection;
	}


	/**
	 * @inheritDoc
	 */
	public closestPointXY(x: number, y: number, closestPoint: Coordinate, minSquaredDistance: number) {
		if (minSquaredDistance < closestSquaredDistanceXY(this.getExtent(), x, y)) {
			return minSquaredDistance;
		}
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			minSquaredDistance = geometries[i].closestPointXY(
				x, y, closestPoint, minSquaredDistance);
		}
		return minSquaredDistance;
	}


	/**
	 * @inheritDoc
	 */
	public containsXY(x: number, y: number) {
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			if (geometries[i].containsXY(x, y)) {
				return true;
			}
		}
		return false;
	}


	/**
	 * @inheritDoc
	 */
	public computeExtent(extent: Extent) {
		createOrUpdateEmpty(extent);
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			extend(extent, geometries[i].getExtent());
		}
		return extent;
	}


	/**
	 * Return the geometries that make up this geometry collection.
	 * @return {Array.<module:ol/geom/Geometry>} Geometries.
	 * @api
	 */
	public getGeometries() {
		return cloneGeometries(this.geometries!);
	}


	/**
	 * @return {Array.<module:ol/geom/Geometry>} Geometries.
	 */
	public getGeometriesArray() {
		return this.geometries;
	}


	/**
	 * @inheritDoc
	 */
	public getSimplifiedGeometry(squaredTolerance: number) {
		if (this.simplifiedGeometryRevision !== this.getRevision()) {
			clear(this.simplifiedGeometryCache);
			this.simplifiedGeometryMaxMinSquaredTolerance = 0;
			this.simplifiedGeometryRevision = this.getRevision();
		}
		if (squaredTolerance < 0 ||
			(this.simplifiedGeometryMaxMinSquaredTolerance !== 0 &&
				squaredTolerance < this.simplifiedGeometryMaxMinSquaredTolerance)) {
			return this;
		}
		const key = squaredTolerance.toString();
		if (this.simplifiedGeometryCache.hasOwnProperty(key)) {
			return this.simplifiedGeometryCache[key] as SimpleGeometry;
		} else {
			const simplifiedGeometries = [];
			const geometries = this.geometries!;
			let simplified = false;
			for (let i = 0, ii = geometries.length; i < ii; ++i) {
				const geometry = geometries[i];
				const simplifiedGeometry = geometry.getSimplifiedGeometry(squaredTolerance);
				simplifiedGeometries.push(simplifiedGeometry);
				if (simplifiedGeometry !== geometry) {
					simplified = true;
				}
			}
			if (simplified) {
				const simplifiedGeometryCollection = new GeometryCollection(null!);
				simplifiedGeometryCollection.setGeometriesArray(simplifiedGeometries);
				this.simplifiedGeometryCache[key] = simplifiedGeometryCollection;
				return simplifiedGeometryCollection;
			} else {
				this.simplifiedGeometryMaxMinSquaredTolerance = squaredTolerance;
				return this;
			}
		}
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public getType() {
		return GeometryType.GEOMETRY_COLLECTION;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public intersectsExtent(extent: Extent) {
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			if (geometries[i].intersectsExtent(extent)) {
				return true;
			}
		}
		return false;
	}


	/**
	 * @return {boolean} Is empty.
	 */
	public isEmpty() {
		return this.geometries!.length === 0;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public rotate(angle: number, anchor: Coordinate) {
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			geometries[i].rotate(angle, anchor);
		}
		this.changed();
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public scale(sx: number, opt_sy?: number, opt_anchor?: Coordinate) {
		const anchor = opt_anchor ? opt_anchor : getCenter(this.getExtent());
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			geometries[i].scale(sx, opt_sy, anchor);
		}
		this.changed();
	}


	/**
	 * Set the geometries that make up this geometry collection.
	 * @param {Array.<module:ol/geom/Geometry>} geometries Geometries.
	 * @api
	 */
	public setGeometries(geometries: Geometry[]) {
		this.setGeometriesArray(cloneGeometries(geometries));
	}


	/**
	 * @param {Array.<module:ol/geom/Geometry>} geometries Geometries.
	 */
	public setGeometriesArray(geometries: Geometry[]) {
		this.unlistenGeometriesChange_();
		this.geometries = geometries;
		this.listenGeometriesChange_();
		this.changed();
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public applyTransform(transformFn: TransformFunction) {
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			geometries[i].applyTransform(transformFn);
		}
		this.changed();
	}


	/**
	 * Translate the geometry.
	 * @param {number} deltaX Delta X.
	 * @param {number} deltaY Delta Y.
	 * @override
	 * @api
	 */
	public translate(deltaX: number, deltaY: number) {
		const geometries = this.geometries!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			geometries[i].translate(deltaX, deltaY);
		}
		this.changed();
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		this.unlistenGeometriesChange_();
		Geometry.prototype.disposeInternal.call(this);
	}


	/**
	 * @private
	 */
	private unlistenGeometriesChange_() {
		if (!this.geometries) {
			return;
		}
		for (let i = 0, ii = this.geometries.length; i < ii; ++i) {
			unlisten(
				this.geometries[i], EventType.CHANGE,
				this.changed, this);
		}
	}


	/**
	 * @private
	 */
	private listenGeometriesChange_() {
		if (!this.geometries) {
			return;
		}
		for (let i = 0, ii = this.geometries.length; i < ii; ++i) {
			listen(
				this.geometries[i], EventType.CHANGE,
				this.changed, this);
		}
	}
}

/**
 * @param {Array.<module:ol/geom/Geometry>} geometries Geometries.
 * @return {Array.<module:ol/geom/Geometry>} Cloned geometries.
 */
function cloneGeometries(geometries: Geometry[]) {
	const clonedGeometries = [];
	for (let i = 0, ii = geometries.length; i < ii; ++i) {
		clonedGeometries.push(geometries[i].clone());
	}
	return clonedGeometries;
}
