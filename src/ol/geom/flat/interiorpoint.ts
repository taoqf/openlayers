/**
 * @module ol/geom/flat/interiorpoint
 */
import { numberSafeCompareFunction } from '../../array';
import { linearRingsContainsXY } from '../flat/contains';


/**
 * Calculates a point that is likely to lie in the interior of the linear rings.
 * Inspired by JTS's com.vividsolutions.jts.geom.Geometry#getInteriorPoint.
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array.<number>} ends Ends.
 * @param {number} stride Stride.
 * @param {Array.<number>} flatCenters Flat centers.
 * @param {number} flatCentersOffset Flat center offset.
 * @param {Array.<number>=} opt_dest Destination.
 * @return {Array.<number>} Destination point as XYM coordinate, where M is the
 * length of the horizontal intersection that the point belongs to.
 */
export function getInteriorPointOfArray(flatCoordinates: number[], offset: number, ends: number[], stride: number, flatCenters: number[], flatCentersOffset: number, opt_dest?: number[]) {
	const y = flatCenters[flatCentersOffset + 1];
	/** @type {Array.<number>} */
	const intersections = [];
	// Calculate intersections with the horizontal line
	for (let r = 0, rr = ends.length; r < rr; ++r) {
		const end = ends[r];
		let _x1 = flatCoordinates[end - stride];
		let y1 = flatCoordinates[end - stride + 1];
		for (let i = offset; i < end; i += stride) {
			const x2 = flatCoordinates[i];
			const y2 = flatCoordinates[i + 1];
			if ((y <= y1 && y2 <= y) || (y1 <= y && y <= y2)) {
				const x = (y - y1) / (y2 - y1) * (x2 - _x1) + _x1;
				intersections.push(x);
			}
			_x1 = x2;
			y1 = y2;
		}
	}
	// Find the longest segment of the horizontal line that has its center point
	// inside the linear ring.
	let pointX = NaN;
	let maxSegmentLength = -Infinity;
	intersections.sort(numberSafeCompareFunction);
	let x1 = intersections[0];
	for (let i = 1, ii = intersections.length; i < ii; ++i) {
		const x2 = intersections[i];
		const segmentLength = Math.abs(x2 - x1);
		if (segmentLength > maxSegmentLength) {
			const x = (x1 + x2) / 2;
			if (linearRingsContainsXY(flatCoordinates, offset, ends, stride, x, y)) {
				pointX = x;
				maxSegmentLength = segmentLength;
			}
		}
		x1 = x2;
	}
	if (isNaN(pointX)) {
		// There is no horizontal line that has its center point inside the linear
		// ring.  Use the center of the the linear ring's extent.
		pointX = flatCenters[flatCentersOffset];
	}
	if (opt_dest) {
		opt_dest.push(pointX, y, maxSegmentLength);
		return opt_dest;
	} else {
		return [pointX, y, maxSegmentLength];
	}
}


/**
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array.<Array.<number>>} endss Endss.
 * @param {number} stride Stride.
 * @param {Array.<number>} flatCenters Flat centers.
 * @return {Array.<number>} Interior points as XYM coordinates, where M is the
 * length of the horizontal intersection that the point belongs to.
 */
export function getInteriorPointsOfMultiArray(flatCoordinates: number[], offset: number, endss: number[][], stride: number, flatCenters: number[]) {
	let interiorPoints = [] as number[];
	for (let i = 0, ii = endss.length; i < ii; ++i) {
		const ends = endss[i];
		interiorPoints = getInteriorPointOfArray(flatCoordinates,
			offset, ends, stride, flatCenters, 2 * i, interiorPoints);
		offset = ends[ends.length - 1];
	}
	return interiorPoints;
}
