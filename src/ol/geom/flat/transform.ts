import { Transform } from '../../transform';

/**
 * @module ol/geom/flat/transform
 */


/**
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {module:ol/transform~Transform} transform Transform.
 * @param {Array.<number>=} opt_dest Destination.
 * @return {Array.<number>} Transformed coordinates.
 */
export function transform2D(flatCoordinates: number[], offset: number, end: number, stride: number, transform: Transform, opt_dest?: number[]) {
	const dest = opt_dest ? opt_dest : [];
	let i = 0;
	for (let j = offset; j < end; j += stride) {
		const x = flatCoordinates[j];
		const y = flatCoordinates[j + 1];
		dest[i++] = transform[0] * x + transform[2] * y + transform[4];
		dest[i++] = transform[1] * x + transform[3] * y + transform[5];
	}
	if (opt_dest && dest.length !== i) {
		dest.length = i;
	}
	return dest;
}


/**
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {number} angle Angle.
 * @param {Array.<number>} anchor Rotation anchor point.
 * @param {Array.<number>=} opt_dest Destination.
 * @return {Array.<number>} Transformed coordinates.
 */
export function rotate(flatCoordinates: number[], offset: number, end: number, stride: number, angle: number, anchor: number[], opt_dest?: number[]) {
	const dest = opt_dest ? opt_dest : [];
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const anchorX = anchor[0];
	const anchorY = anchor[1];
	let i = 0;
	for (let j = offset; j < end; j += stride) {
		const deltaX = flatCoordinates[j] - anchorX;
		const deltaY = flatCoordinates[j + 1] - anchorY;
		dest[i++] = anchorX + deltaX * cos - deltaY * sin;
		dest[i++] = anchorY + deltaX * sin + deltaY * cos;
		for (let k = j + 2; k < j + stride; ++k) {
			dest[i++] = flatCoordinates[k];
		}
	}
	if (opt_dest && dest.length !== i) {
		dest.length = i;
	}
	return dest;
}


/**
 * Scale the coordinates.
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {number} sx Scale factor in the x-direction.
 * @param {number} sy Scale factor in the y-direction.
 * @param {Array.<number>} anchor Scale anchor point.
 * @param {Array.<number>=} opt_dest Destination.
 * @return {Array.<number>} Transformed coordinates.
 */
export function scale(flatCoordinates: number[], offset: number, end: number, stride: number, sx: number, sy: number, anchor: number[], opt_dest?: number[]) {
	const dest = opt_dest ? opt_dest : [];
	const anchorX = anchor[0];
	const anchorY = anchor[1];
	let i = 0;
	for (let j = offset; j < end; j += stride) {
		const deltaX = flatCoordinates[j] - anchorX;
		const deltaY = flatCoordinates[j + 1] - anchorY;
		dest[i++] = anchorX + sx * deltaX;
		dest[i++] = anchorY + sy * deltaY;
		for (let k = j + 2; k < j + stride; ++k) {
			dest[i++] = flatCoordinates[k];
		}
	}
	if (opt_dest && dest.length !== i) {
		dest.length = i;
	}
	return dest;
}


/**
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {number} offset Offset.
 * @param {number} end End.
 * @param {number} stride Stride.
 * @param {number} deltaX Delta X.
 * @param {number} deltaY Delta Y.
 * @param {Array.<number>=} opt_dest Destination.
 * @return {Array.<number>} Transformed coordinates.
 */
export function translate(flatCoordinates: number[], offset: number, end: number, stride: number, deltaX: number, deltaY: number, opt_dest?: number[]) {
	const dest = opt_dest ? opt_dest : [];
	let i = 0;
	for (let j = offset; j < end; j += stride) {
		dest[i++] = flatCoordinates[j] + deltaX;
		dest[i++] = flatCoordinates[j + 1] + deltaY;
		for (let k = j + 2; k < j + stride; ++k) {
			dest[i++] = flatCoordinates[k];
		}
	}
	if (opt_dest && dest.length !== i) {
		dest.length = i;
	}
	return dest;
}
