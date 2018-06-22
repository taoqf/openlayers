/**
 * @module ol/geom/flat/center
 */
import { createEmpty, createOrUpdateFromFlatCoordinates } from '../../extent';


/**
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {Array.<Array.<number>>} endss Endss.
 * @param {number} stride Stride.
 * @return {Array.<number>} Flat centers.
 */
export function linearRingss(flatCoordinates: number[], offset: number, endss: number[][], stride: number) {
	const flatCenters = [];
	let extent = createEmpty();
	for (let i = 0, ii = endss.length; i < ii; ++i) {
		const ends = endss[i];
		extent = createOrUpdateFromFlatCoordinates(flatCoordinates, offset, ends[0], stride);
		flatCenters.push((extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2);
		offset = ends[ends.length - 1];
	}
	return flatCenters;
}
