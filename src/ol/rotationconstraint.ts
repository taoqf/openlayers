/**
 * @module ol/rotationconstraint
 */
import { toRadians } from './math';


/**
 * @typedef {function((number|undefined), number): (number|undefined)} Type
 */

export type Type = (rotation: number | undefined, delta: number) => number | undefined;

/**
 * @param {number|undefined} rotation Rotation.
 * @param {number} delta Delta.
 * @return {number|undefined} Rotation.
 */
export function disable(rotation: number | undefined, _delta: number) {
	if (rotation !== undefined) {
		return 0;
	} else {
		return undefined;
	}
}


/**
 * @param {number|undefined} rotation Rotation.
 * @param {number} delta Delta.
 * @return {number|undefined} Rotation.
 */
export function none(rotation: number | undefined, delta: number) {
	if (rotation !== undefined) {
		return rotation + delta;
	} else {
		return undefined;
	}
}


/**
 * @param {number} n N.
 * @return {module:ol/rotationconstraint~Type} Rotation constraint.
 */
export function createSnapToN(n: number) {
	const theta = 2 * Math.PI / n;
	return (
		/**
		 * @param {number|undefined} rotation Rotation.
		 * @param {number} delta Delta.
		 * @return {number|undefined} Rotation.
		 */
		(rotation: number | undefined, delta: number) => {
			if (rotation !== undefined) {
				rotation = Math.floor((rotation + delta) / theta + 0.5) * theta;
				return rotation;
			} else {
				return undefined;
			}
		});
}


/**
 * @param {number=} opt_tolerance Tolerance.
 * @return {module:ol/rotationconstraint~Type} Rotation constraint.
 */
export function createSnapToZero(opt_tolerance?: number) {
	const tolerance = opt_tolerance || toRadians(5);
	return (
		/**
		 * @param {number|undefined} rotation Rotation.
		 * @param {number} delta Delta.
		 * @return {number|undefined} Rotation.
		 */
		(rotation: number | undefined, delta: number) => {
			if (rotation !== undefined) {
				if (Math.abs(rotation + delta) <= tolerance) {
					return 0;
				} else {
					return rotation + delta;
				}
			} else {
				return undefined;
			}
		});
}
