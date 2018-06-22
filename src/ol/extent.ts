/**
 * @module ol/extent
 */
import { assert } from './asserts';
import { Coordinate } from './coordinate';
import Corner from './extent/Corner';
import Relationship from './extent/Relationship';
import { TransformFunction } from './proj';
import { Size } from './size';


/**
 * An array of numbers representing an extent: `[minx, miny, maxx, maxy]`.
 * @typedef {Array.<number>} Extent
 * @api
 */

export type Extent = [number, number, number, number];

/**
 * Build an extent that includes all given coordinates.
 *
 * @param {Array.<module:ol/coordinate~Coordinate>} coordinates Coordinates.
 * @return {module:ol/extent~Extent} Bounding extent.
 * @api
 */
export function boundingExtent(coordinates: Coordinate[]) {
	const extent = createEmpty() as Extent;
	for (let i = 0, ii = coordinates.length; i < ii; ++i) {
		extendCoordinate(extent, coordinates[i]);
	}
	return extent;
}


/**
 * @param {Array.<number>} xs Xs.
 * @param {Array.<number>} ys Ys.
 * @param {module:ol/extent~Extent=} opt_extent Destination extent.
 * @private
 * @return {module:ol/extent~Extent} Extent.
 */
function _boundingExtentXYs(xs: number[], ys: number[], opt_extent?: Extent) {
	const minX = Math.min.apply(null, xs);
	const minY = Math.min.apply(null, ys);
	const maxX = Math.max.apply(null, xs);
	const maxY = Math.max.apply(null, ys);
	return createOrUpdate(minX, minY, maxX, maxY, opt_extent);
}


/**
 * Return extent increased by the provided value.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} value The amount by which the extent should be buffered.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} Extent.
 * @api
 */
export function buffer(extent: Extent, value: number, opt_extent?: Extent): Extent {
	if (opt_extent) {
		opt_extent[0] = extent[0] - value;
		opt_extent[1] = extent[1] - value;
		opt_extent[2] = extent[2] + value;
		opt_extent[3] = extent[3] + value;
		return opt_extent;
	} else {
		return [
			extent[0] - value,
			extent[1] - value,
			extent[2] + value,
			extent[3] + value
		];
	}
}


/**
 * Creates a clone of an extent.
 *
 * @param {module:ol/extent~Extent} extent Extent to clone.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} The clone.
 */
export function clone(extent: Extent, opt_extent?: Extent) {
	if (opt_extent) {
		opt_extent[0] = extent[0];
		opt_extent[1] = extent[1];
		opt_extent[2] = extent[2];
		opt_extent[3] = extent[3];
		return opt_extent;
	} else {
		return extent.slice();
	}
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} x X.
 * @param {number} y Y.
 * @return {number} Closest squared distance.
 */
export function closestSquaredDistanceXY(extent: Extent, x: number, y: number) {
	const dx = (() => {
		if (x < extent[0]) {
			return extent[0] - x;
		} else if (extent[2] < x) {
			return x - extent[2];
		} else {
			return 0;
		}
	})();
	const dy = (() => {
		if (y < extent[1]) {
			return extent[1] - y;
		} else if (extent[3] < y) {
			return y - extent[3];
		} else {
			return 0;
		}
	})();
	return dx * dx + dy * dy;
}


/**
 * Check if the passed coordinate is contained or on the edge of the extent.
 *
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
 * @return {boolean} The coordinate is contained in the extent.
 * @api
 */
export function containsCoordinate(extent: Extent, coordinate: Coordinate) {
	return containsXY(extent, coordinate[0], coordinate[1]);
}


/**
 * Check if one extent contains another.
 *
 * An extent is deemed contained if it lies completely within the other extent,
 * including if they share one or more edges.
 *
 * @param {module:ol/extent~Extent} extent1 Extent 1.
 * @param {module:ol/extent~Extent} extent2 Extent 2.
 * @return {boolean} The second extent is contained by or on the edge of the
 *     first.
 * @api
 */
export function containsExtent(extent1: Extent, extent2: Extent) {
	return extent1[0] <= extent2[0] && extent2[2] <= extent1[2] &&
		extent1[1] <= extent2[1] && extent2[3] <= extent1[3];
}


/**
 * Check if the passed coordinate is contained or on the edge of the extent.
 *
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} x X coordinate.
 * @param {number} y Y coordinate.
 * @return {boolean} The x, y values are contained in the extent.
 * @api
 */
export function containsXY(extent: Extent, x: number, y: number) {
	return extent[0] <= x && x <= extent[2] && extent[1] <= y && y <= extent[3];
}


/**
 * Get the relationship between a coordinate and extent.
 * @param {module:ol/extent~Extent} extent The extent.
 * @param {module:ol/coordinate~Coordinate} coordinate The coordinate.
 * @return {module:ol/extent/Relationship} The relationship (bitwise compare with
 *     module:ol/extent/Relationship~Relationship).
 */
export function coordinateRelationship(extent: Extent, coordinate: Coordinate) {
	const minX = extent[0];
	const minY = extent[1];
	const maxX = extent[2];
	const maxY = extent[3];
	const x = coordinate[0];
	const y = coordinate[1];
	let relationship = Relationship.UNKNOWN;
	if (x < minX) {
		relationship = relationship | Relationship.LEFT;
	} else if (x > maxX) {
		relationship = relationship | Relationship.RIGHT;
	}
	if (y < minY) {
		relationship = relationship | Relationship.BELOW;
	} else if (y > maxY) {
		relationship = relationship | Relationship.ABOVE;
	}
	if (relationship === Relationship.UNKNOWN) {
		relationship = Relationship.INTERSECTING;
	}
	return relationship;
}


/**
 * Create an empty extent.
 * @return {module:ol/extent~Extent} Empty extent.
 * @api
 */
export function createEmpty() {
	return [Infinity, Infinity, -Infinity, -Infinity] as Extent;
}


/**
 * Create a new extent or update the provided extent.
 * @param {number} minX Minimum X.
 * @param {number} minY Minimum Y.
 * @param {number} maxX Maximum X.
 * @param {number} maxY Maximum Y.
 * @param {module:ol/extent~Extent=} opt_extent Destination extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function createOrUpdate(minX: number, minY: number, maxX: number, maxY: number, opt_extent?: Extent) {
	if (opt_extent) {
		opt_extent[0] = minX;
		opt_extent[1] = minY;
		opt_extent[2] = maxX;
		opt_extent[3] = maxY;
		return opt_extent;
	} else {
		return [minX, minY, maxX, maxY] as Extent;
	}
}


/**
 * Create a new empty extent or make the provided one empty.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function createOrUpdateEmpty(opt_extent?: Extent) {
	return createOrUpdate(
		Infinity, Infinity, -Infinity, -Infinity, opt_extent);
}


/**
 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function createOrUpdateFromCoordinate(coordinate: Coordinate, opt_extent?: Extent) {
	const x = coordinate[0];
	const y = coordinate[1];
	return createOrUpdate(x, y, x, y, opt_extent);
}


/**
 * @param {Array.<module:ol/coordinate~Coordinate>} coordinates Coordinates.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function createOrUpdateFromCoordinates(coordinates: Coordinate[], opt_extent?: Extent) {
	const extent = createOrUpdateEmpty(opt_extent);
	return extendCoordinates(extent, coordinates);
}


/**
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function createOrUpdateFromFlatCoordinates(flatCoordinates: number[], offset: number, end: number, stride: number, opt_extent?: Extent) {
	const extent = createOrUpdateEmpty(opt_extent);
	return extendFlatCoordinates(extent, flatCoordinates, offset, end, stride);
}

/**
 * @param {Array.<Array.<module:ol/coordinate~Coordinate>>} rings Rings.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function createOrUpdateFromRings(rings: Coordinate[][], opt_extent?: Extent) {
	const extent = createOrUpdateEmpty(opt_extent);
	return extendRings(extent, rings);
}


/**
 * Determine if two extents are equivalent.
 * @param {module:ol/extent~Extent} extent1 Extent 1.
 * @param {module:ol/extent~Extent} extent2 Extent 2.
 * @return {boolean} The two extents are equivalent.
 * @api
 */
export function equals(extent1: Extent, extent2: Extent) {
	return extent1[0] === extent2[0] && extent1[2] === extent2[2] &&
		extent1[1] === extent2[1] && extent1[3] === extent2[3];
}


/**
 * Modify an extent to include another extent.
 * @param {module:ol/extent~Extent} extent1 The extent to be modified.
 * @param {module:ol/extent~Extent} extent2 The extent that will be included in the first.
 * @return {module:ol/extent~Extent} A reference to the first (extended) extent.
 * @api
 */
export function extend(extent1: Extent, extent2: Extent) {
	if (extent2[0] < extent1[0]) {
		extent1[0] = extent2[0];
	}
	if (extent2[2] > extent1[2]) {
		extent1[2] = extent2[2];
	}
	if (extent2[1] < extent1[1]) {
		extent1[1] = extent2[1];
	}
	if (extent2[3] > extent1[3]) {
		extent1[3] = extent2[3];
	}
	return extent1;
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
 */
export function extendCoordinate(extent: Extent, coordinate: Coordinate) {
	if (coordinate[0] < extent[0]) {
		extent[0] = coordinate[0];
	}
	if (coordinate[0] > extent[2]) {
		extent[2] = coordinate[0];
	}
	if (coordinate[1] < extent[1]) {
		extent[1] = coordinate[1];
	}
	if (coordinate[1] > extent[3]) {
		extent[3] = coordinate[1];
	}
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {Array.<module:ol/coordinate~Coordinate>} coordinates Coordinates.
 * @return {module:ol/extent~Extent} Extent.
 */
export function extendCoordinates(extent: Extent, coordinates: Coordinate[]) {
	for (let i = 0, ii = coordinates.length; i < ii; ++i) {
		extendCoordinate(extent, coordinates[i]);
	}
	return extent;
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @return {module:ol/extent~Extent} Extent.
 */
export function extendFlatCoordinates(extent: Extent, flatCoordinates: number[], offset: number, end: number, stride: number) {
	for (; offset < end; offset += stride) {
		extendXY(extent, flatCoordinates[offset], flatCoordinates[offset + 1]);
	}
	return extent;
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {Array.<Array.<module:ol/coordinate~Coordinate>>} rings Rings.
 * @return {module:ol/extent~Extent} Extent.
 */
export function extendRings(extent: Extent, rings: Coordinate[][]) {
	for (let i = 0, ii = rings.length; i < ii; ++i) {
		extendCoordinates(extent, rings[i]);
	}
	return extent;
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} x X.
 * @param {number} y Y.
 */
export function extendXY(extent: Extent, x: number, y: number) {
	extent[0] = Math.min(extent[0], x);
	extent[1] = Math.min(extent[1], y);
	extent[2] = Math.max(extent[2], x);
	extent[3] = Math.max(extent[3], y);
}


/**
 * This function calls `callback` for each corner of the extent. If the
 * callback returns a truthy value the function returns that value
 * immediately. Otherwise the function returns `false`.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {function(this:T, module:ol/coordinate~Coordinate): S} callback Callback.
 * @param {T=} opt_this Value to use as `this` when executing `callback`.
 * @return {S|boolean} Value.
 * @template S, T
 */
export function forEachCorner<T, S>(extent: Extent, callback: (coordinate: Coordinate) => S, opt_this?: T): S | boolean {
	let val;
	val = callback.call(opt_this, getBottomLeft(extent));
	if (val) {
		return val;
	}
	val = callback.call(opt_this, getBottomRight(extent));
	if (val) {
		return val;
	}
	val = callback.call(opt_this, getTopRight(extent));
	if (val) {
		return val;
	}
	val = callback.call(opt_this, getTopLeft(extent));
	if (val) {
		return val;
	}
	return false;
}


/**
 * Get the size of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {number} Area.
 * @api
 */
export function getArea(extent: Extent) {
	let area = 0;
	if (!isEmpty(extent)) {
		area = getWidth(extent) * getHeight(extent);
	}
	return area;
}


/**
 * Get the bottom left coordinate of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {module:ol/coordinate~Coordinate} Bottom left coordinate.
 * @api
 */
export function getBottomLeft(extent: Extent) {
	return [extent[0], extent[1]] as Coordinate;
}


/**
 * Get the bottom right coordinate of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {module:ol/coordinate~Coordinate} Bottom right coordinate.
 * @api
 */
export function getBottomRight(extent: Extent) {
	return [extent[2], extent[1]] as Coordinate;
}


/**
 * Get the center coordinate of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {module:ol/coordinate~Coordinate} Center.
 * @api
 */
export function getCenter(extent: Extent) {
	return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2] as Coordinate;
}


/**
 * Get a corner coordinate of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {module:ol/extent/Corner} corner Corner.
 * @return {module:ol/coordinate~Coordinate} Corner coordinate.
 */
export function getCorner(extent: Extent, corner: Corner) {
	let coordinate;
	if (corner === Corner.BOTTOM_LEFT) {
		coordinate = getBottomLeft(extent);
	} else if (corner === Corner.BOTTOM_RIGHT) {
		coordinate = getBottomRight(extent);
	} else if (corner === Corner.TOP_LEFT) {
		coordinate = getTopLeft(extent);
	} else if (corner === Corner.TOP_RIGHT) {
		coordinate = getTopRight(extent);
	} else {
		assert(false, 13); // Invalid corner
	}
	return (
	/** @type {!module:ol/coordinate~Coordinate} */ (coordinate)
	);
}


/**
 * @param {module:ol/extent~Extent} extent1 Extent 1.
 * @param {module:ol/extent~Extent} extent2 Extent 2.
 * @return {number} Enlarged area.
 */
export function getEnlargedArea(extent1: Extent, extent2: Extent) {
	const minX = Math.min(extent1[0], extent2[0]);
	const minY = Math.min(extent1[1], extent2[1]);
	const maxX = Math.max(extent1[2], extent2[2]);
	const maxY = Math.max(extent1[3], extent2[3]);
	return (maxX - minX) * (maxY - minY);
}


/**
 * @param {module:ol/coordinate~Coordinate} center Center.
 * @param {number} resolution Resolution.
 * @param {number} rotation Rotation.
 * @param {module:ol/size~Size} size Size.
 * @param {module:ol/extent~Extent=} opt_extent Destination extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function getForViewAndSize(center: Coordinate, resolution: number, rotation: number, size: Size, opt_extent?: Extent) {
	const dx = resolution * size[0] / 2;
	const dy = resolution * size[1] / 2;
	const cosRotation = Math.cos(rotation);
	const sinRotation = Math.sin(rotation);
	const xCos = dx * cosRotation;
	const xSin = dx * sinRotation;
	const yCos = dy * cosRotation;
	const ySin = dy * sinRotation;
	const x = center[0];
	const y = center[1];
	const x0 = x - xCos + ySin;
	const x1 = x - xCos - ySin;
	const x2 = x + xCos - ySin;
	const x3 = x + xCos + ySin;
	const y0 = y - xSin - yCos;
	const y1 = y - xSin + yCos;
	const y2 = y + xSin + yCos;
	const y3 = y + xSin - yCos;
	return createOrUpdate(
		Math.min(x0, x1, x2, x3), Math.min(y0, y1, y2, y3),
		Math.max(x0, x1, x2, x3), Math.max(y0, y1, y2, y3),
		opt_extent);
}


/**
 * Get the height of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {number} Height.
 * @api
 */
export function getHeight(extent: Extent) {
	return extent[3] - extent[1];
}


/**
 * @param {module:ol/extent~Extent} extent1 Extent 1.
 * @param {module:ol/extent~Extent} extent2 Extent 2.
 * @return {number} Intersection area.
 */
export function getIntersectionArea(extent1: Extent, extent2: Extent) {
	const intersection = getIntersection(extent1, extent2);
	return getArea(intersection);
}


/**
 * Get the intersection of two extents.
 * @param {module:ol/extent~Extent} extent1 Extent 1.
 * @param {module:ol/extent~Extent} extent2 Extent 2.
 * @param {module:ol/extent~Extent=} opt_extent Optional extent to populate with intersection.
 * @return {module:ol/extent~Extent} Intersecting extent.
 * @api
 */
export function getIntersection(extent1: Extent, extent2: Extent, opt_extent?: Extent) {
	const intersection = opt_extent ? opt_extent : createEmpty() as Extent;
	if (intersects(extent1, extent2)) {
		if (extent1[0] > extent2[0]) {
			intersection[0] = extent1[0];
		} else {
			intersection[0] = extent2[0];
		}
		if (extent1[1] > extent2[1]) {
			intersection[1] = extent1[1];
		} else {
			intersection[1] = extent2[1];
		}
		if (extent1[2] < extent2[2]) {
			intersection[2] = extent1[2];
		} else {
			intersection[2] = extent2[2];
		}
		if (extent1[3] < extent2[3]) {
			intersection[3] = extent1[3];
		} else {
			intersection[3] = extent2[3];
		}
	} else {
		createOrUpdateEmpty(intersection);
	}
	return intersection;
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {number} Margin.
 */
export function getMargin(extent: Extent) {
	return getWidth(extent) + getHeight(extent);
}


/**
 * Get the size (width, height) of an extent.
 * @param {module:ol/extent~Extent} extent The extent.
 * @return {module:ol/size~Size} The extent size.
 * @api
 */
export function getSize(extent: Extent) {
	return [extent[2] - extent[0], extent[3] - extent[1]];
}


/**
 * Get the top left coordinate of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {module:ol/coordinate~Coordinate} Top left coordinate.
 * @api
 */
export function getTopLeft(extent: Extent) {
	return [extent[0], extent[3]] as Coordinate;
}


/**
 * Get the top right coordinate of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {module:ol/coordinate~Coordinate} Top right coordinate.
 * @api
 */
export function getTopRight(extent: Extent) {
	return [extent[2], extent[3]] as Coordinate;
}


/**
 * Get the width of an extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {number} Width.
 * @api
 */
export function getWidth(extent: Extent) {
	return extent[2] - extent[0];
}


/**
 * Determine if one extent intersects another.
 * @param {module:ol/extent~Extent} extent1 Extent 1.
 * @param {module:ol/extent~Extent} extent2 Extent.
 * @return {boolean} The two extents intersect.
 * @api
 */
export function intersects(extent1: Extent, extent2: Extent) {
	return extent1[0] <= extent2[2] &&
		extent1[2] >= extent2[0] &&
		extent1[1] <= extent2[3] &&
		extent1[3] >= extent2[1];
}


/**
 * Determine if an extent is empty.
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {boolean} Is empty.
 * @api
 */
export function isEmpty(extent: Extent) {
	return extent[2] < extent[0] || extent[3] < extent[1];
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {module:ol/extent~Extent=} opt_extent Extent.
 * @return {module:ol/extent~Extent} Extent.
 */
export function returnOrUpdate(extent: Extent, opt_extent?: Extent) {
	if (opt_extent) {
		opt_extent[0] = extent[0];
		opt_extent[1] = extent[1];
		opt_extent[2] = extent[2];
		opt_extent[3] = extent[3];
		return opt_extent;
	} else {
		return extent;
	}
}


/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} value Value.
 */
export function scaleFromCenter(extent: Extent, value: number) {
	const deltaX = ((extent[2] - extent[0]) / 2) * (value - 1);
	const deltaY = ((extent[3] - extent[1]) / 2) * (value - 1);
	extent[0] -= deltaX;
	extent[2] += deltaX;
	extent[1] -= deltaY;
	extent[3] += deltaY;
}


/**
 * Determine if the segment between two coordinates intersects (crosses,
 * touches, or is contained by) the provided extent.
 * @param {module:ol/extent~Extent} extent The extent.
 * @param {module:ol/coordinate~Coordinate} start Segment start coordinate.
 * @param {module:ol/coordinate~Coordinate} end Segment end coordinate.
 * @return {boolean} The segment intersects the extent.
 */
export function intersectsSegment(extent: Extent, start: Coordinate, end: Coordinate) {
	let intersect = false;
	const startRel = coordinateRelationship(extent, start);
	const endRel = coordinateRelationship(extent, end);
	if (startRel === Relationship.INTERSECTING ||
		endRel === Relationship.INTERSECTING) {
		intersect = true;
	} else {
		const minX = extent[0];
		const minY = extent[1];
		const maxX = extent[2];
		const maxY = extent[3];
		const startX = start[0];
		const startY = start[1];
		const endX = end[0];
		const endY = end[1];
		const slope = (endY - startY) / (endX - startX);
		if (!!(endRel & Relationship.ABOVE) &&
			!(startRel & Relationship.ABOVE)) {
			// potentially intersects top
			const x = endX - ((endY - maxY) / slope);
			intersect = x >= minX && x <= maxX;
		}
		if (!intersect && !!(endRel & Relationship.RIGHT) &&
			!(startRel & Relationship.RIGHT)) {
			// potentially intersects right
			const y = endY - ((endX - maxX) * slope);
			intersect = y >= minY && y <= maxY;
		}
		if (!intersect && !!(endRel & Relationship.BELOW) &&
			!(startRel & Relationship.BELOW)) {
			// potentially intersects bottom
			const x = endX - ((endY - minY) / slope);
			intersect = x >= minX && x <= maxX;
		}
		if (!intersect && !!(endRel & Relationship.LEFT) &&
			!(startRel & Relationship.LEFT)) {
			// potentially intersects left
			const y = endY - ((endX - minX) * slope);
			intersect = y >= minY && y <= maxY;
		}

	}
	return intersect;
}


/**
 * Apply a transform function to the extent.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {module:ol/proj~TransformFunction} transformFn Transform function.
 * Called with `[minX, minY, maxX, maxY]` extent coordinates.
 * @param {module:ol/extent~Extent=} opt_extent Destination extent.
 * @return {module:ol/extent~Extent} Extent.
 * @api
 */
export function applyTransform(extent: Extent, transformFn: TransformFunction, opt_extent?: Extent) {
	const coordinates = [
		extent[0], extent[1],
		extent[0], extent[3],
		extent[2], extent[1],
		extent[2], extent[3]
	];
	transformFn(coordinates, coordinates, 2);
	const xs = [coordinates[0], coordinates[2], coordinates[4], coordinates[6]];
	const ys = [coordinates[1], coordinates[3], coordinates[5], coordinates[7]];
	return _boundingExtentXYs(xs, ys, opt_extent);
}
