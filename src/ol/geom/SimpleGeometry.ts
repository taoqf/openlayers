/**
 * @module ol/geom/SimpleGeometry
 */
import { Coordinate } from '../coordinate';
import { createOrUpdateFromFlatCoordinates, Extent, getCenter } from '../extent';
import { rotate, scale, transform2D, translate } from '../geom/flat/transform';
import Geometry from '../geom/Geometry';
import GeometryLayout from '../geom/GeometryLayout';
import { clear } from '../obj';
import { TransformFunction } from '../proj';
import { Transform } from '../transform';

/**
 * @classdesc
 * Abstract base class; only used for creating subclasses; do not instantiate
 * in apps, as cannot be rendered.
 *
 * @constructor
 * @abstract
 * @extends {module:ol/geom/Geometry}
 * @api
 */
export default abstract class SimpleGeometry extends Geometry {
	/**
	 * @protected
	 * @type {module:ol/geom/GeometryLayout}
	 */
	protected layout = GeometryLayout.XY;

	/**
	 * @protected
	 * @type {number}
	 */
	protected stride = 2;

	/**
	 * @protected
	 * @type {Array.<number>}
	 */
	protected flatCoordinates: number[] = null!;


	/**
	 * @inheritDoc
	 */
	public containsXY(_x: number, _y: number) {
		return false;
	}


	/**
	 * @inheritDoc
	 */
	public computeExtent(extent: Extent) {
		return createOrUpdateFromFlatCoordinates(this.flatCoordinates,
			0, this.flatCoordinates.length, this.stride, extent);
	}

	/**
	 * @abstract
	 * @return {Array} Coordinates.
	 */
	public abstract getCoordinates(): Coordinate | Coordinate[] | Coordinate[][] | Coordinate[][][] | number[] | void;


	/**
	 * Return the first coordinate of the geometry.
	 * @return {module:ol/coordinate~Coordinate} First coordinate.
	 * @api
	 */
	public getFirstCoordinate() {
		return this.flatCoordinates.slice(0, this.stride) as Coordinate;
	}


	/**
	 * @return {Array.<number>} Flat coordinates.
	 */
	public getFlatCoordinates() {
		return this.flatCoordinates;
	}


	/**
	 * Return the last coordinate of the geometry.
	 * @return {module:ol/coordinate~Coordinate} Last point.
	 * @api
	 */
	public getLastCoordinate() {
		return this.flatCoordinates.slice(this.flatCoordinates.length - this.stride) as Coordinate;
	}


	/**
	 * Return the {@link module:ol/geom/GeometryLayout~GeometryLayout layout} of the geometry.
	 * @return {module:ol/geom/GeometryLayout} Layout.
	 * @api
	 */
	public getLayout() {
		return this.layout;
	}


	/**
	 * @inheritDoc
	 */
	public getSimplifiedGeometry(squaredTolerance: number): SimpleGeometry {
		if (this.simplifiedGeometryRevision !== this.getRevision()) {
			clear(this.simplifiedGeometryCache);
			this.simplifiedGeometryMaxMinSquaredTolerance = 0;
			this.simplifiedGeometryRevision = this.getRevision();
		}
		// If squaredTolerance is negative or if we know that simplification will not
		// have any effect then just return this.
		if (squaredTolerance < 0 || (this.simplifiedGeometryMaxMinSquaredTolerance !== 0 && squaredTolerance <= this.simplifiedGeometryMaxMinSquaredTolerance)) {
			return this;
		}
		const key = squaredTolerance.toString();
		if (this.simplifiedGeometryCache.hasOwnProperty(key)) {
			return this.simplifiedGeometryCache[key] as SimpleGeometry;
		} else {
			const simplifiedGeometry =
				this.getSimplifiedGeometryInternal(squaredTolerance);
			const simplifiedFlatCoordinates = simplifiedGeometry.getFlatCoordinates();
			if (simplifiedFlatCoordinates.length < this.flatCoordinates.length) {
				this.simplifiedGeometryCache[key] = simplifiedGeometry;
				return simplifiedGeometry;
			} else {
				// Simplification did not actually remove any coordinates.  We now know
				// that any calls to getSimplifiedGeometry with a squaredTolerance less
				// than or equal to the current squaredTolerance will also not have any
				// effect.  This allows us to short circuit simplification (saving CPU
				// cycles) and prevents the cache of simplified geometries from filling
				// up with useless identical copies of this geometry (saving memory).
				this.simplifiedGeometryMaxMinSquaredTolerance = squaredTolerance;
				return this;
			}
		}
	}

	/**
	 * @return {number} Stride.
	 */
	public getStride() {
		return this.stride;
	}

	/**
	 * @abstract
	 * @param {Array} coordinates Coordinates.
	 * @param {module:ol/geom/GeometryLayout=} opt_layout Layout.
	 */
	public abstract setCoordinates(coordinates: Coordinate | Coordinate[] | Coordinate[][] | Coordinate[][][] | null, opt_layout?: GeometryLayout): void;


	/**
	 * @inheritDoc
	 * @api
	 */
	public applyTransform(transformFn: TransformFunction) {
		if (this.flatCoordinates) {
			transformFn(this.flatCoordinates, this.flatCoordinates, this.stride);
			this.changed();
		}
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public rotate(angle: number, anchor: number[]) {
		const flatCoordinates = this.getFlatCoordinates();
		if (flatCoordinates) {
			const stride = this.getStride();
			rotate(
				flatCoordinates, 0, flatCoordinates.length,
				stride, angle, anchor, flatCoordinates);
			this.changed();
		}
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public scale(sx: number, opt_sy?: number, opt_anchor?: number[]) {
		let sy = opt_sy;
		if (sy === undefined) {
			sy = sx;
		}
		let anchor = opt_anchor;
		if (!anchor) {
			anchor = getCenter(this.getExtent());
		}
		const flatCoordinates = this.getFlatCoordinates();
		if (flatCoordinates) {
			const stride = this.getStride();
			scale(
				flatCoordinates, 0, flatCoordinates.length,
				stride, sx, sy, anchor, flatCoordinates);
			this.changed();
		}
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public translate(deltaX: number, deltaY: number) {
		const flatCoordinates = this.getFlatCoordinates();
		if (flatCoordinates) {
			const stride = this.getStride();
			translate(
				flatCoordinates, 0, flatCoordinates.length, stride,
				deltaX, deltaY, flatCoordinates);
			this.changed();
		}
	}

	/**
	 * @param {number} squaredTolerance Squared tolerance.
	 * @return {module:ol/geom/SimpleGeometry} Simplified geometry.
	 * @protected
	 */
	protected getSimplifiedGeometryInternal(_squaredTolerance: number) {
		return this as SimpleGeometry;
	}

	/**
	 * @param {module:ol/geom/GeometryLayout} layout Layout.
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @protected
	 */
	protected setFlatCoordinatesInternal(layout: GeometryLayout, flatCoordinates: number[] | null) {
		this.stride = getStrideForLayout(layout)!;
		this.layout = layout;
		this.flatCoordinates = flatCoordinates!;
	}

	/**
	 * @param {module:ol/geom/GeometryLayout|undefined} layout Layout.
	 * @param {Array} coordinates Coordinates.
	 * @param {number} nesting Nesting.
	 * @protected
	 */
	protected setLayout(layout: GeometryLayout | undefined | null, coordinates: Coordinate[][] | Coordinate[][][] | Coordinate[] | Coordinate, nesting: number) {
		// ? typeof coordinates
		let stride;
		if (layout) {
			stride = getStrideForLayout(layout)!;
		} else {
			for (let i = 0; i < nesting; ++i) {
				if (coordinates.length === 0) {
					this.layout = GeometryLayout.XY;
					this.stride = 2;
					return;
				} else {
					coordinates = coordinates[0] as Coordinate[];
				}
			}
			stride = coordinates.length;
			layout = getLayoutForStride(stride);
		}
		this.layout = layout;
		this.stride = stride;
	}
}


/**
 * @param {number} stride Stride.
 * @return {module:ol/geom/GeometryLayout} layout Layout.
 */
function getLayoutForStride(stride: 2 | 3 | 4 | number) {
	let layout: GeometryLayout;
	if (stride === 2) {
		layout = GeometryLayout.XY;
	} else if (stride === 3) {
		layout = GeometryLayout.XYZ;
	} else if (stride === 4) {
		layout = GeometryLayout.XYZM;
	}
	return layout!;
}


/**
 * @param {module:ol/geom/GeometryLayout} layout Layout.
 * @return {number} Stride.
 */
export function getStrideForLayout(layout: GeometryLayout) {
	let stride;
	if (layout === GeometryLayout.XY) {
		stride = 2;
	} else if (layout === GeometryLayout.XYZ || layout === GeometryLayout.XYM) {
		stride = 3;
	} else if (layout === GeometryLayout.XYZM) {
		stride = 4;
	}
	return /** @type {number} */ (stride);
}

/**
 * @param {module:ol/geom/SimpleGeometry} simpleGeometry Simple geometry.
 * @param {module:ol/transform~Transform} transform Transform.
 * @param {Array.<number>=} opt_dest Destination.
 * @return {Array.<number>} Transformed flat coordinates.
 */
export function transformGeom2D(simpleGeometry: SimpleGeometry, transform: Transform, opt_dest?: number[]) {
	const flatCoordinates = simpleGeometry.getFlatCoordinates();
	if (!flatCoordinates) {
		return null;
	} else {
		const stride = simpleGeometry.getStride();
		return transform2D(
			flatCoordinates, 0, flatCoordinates.length, stride,
			transform, opt_dest);
	}
}
