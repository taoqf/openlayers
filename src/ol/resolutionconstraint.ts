/**
 * @module ol/resolutionconstraint
 */
import { linearFindNearest } from './array';
import { clamp } from './math';


/**
 * @typedef {function((number|undefined), number, number): (number|undefined)} Type
 */

export type Type = (resolution: number | undefined, delta: number, direction: number) => number | undefined;

/**
 * @param {Array.<number>} resolutions Resolutions.
 * @return {module:ol/resolutionconstraint~Type} Zoom function.
 */
export function createSnapToResolutions(resolutions: number[]) {
	return (
		/**
		 * @param {number|undefined} resolution Resolution.
		 * @param {number} delta Delta.
		 * @param {number} direction Direction.
		 * @return {number|undefined} Resolution.
		 */
		(resolution: number | undefined, delta: number, direction: number) => {
			if (resolution !== undefined) {
				let z = linearFindNearest(resolutions, resolution, direction);
				z = clamp(z + delta, 0, resolutions.length - 1);
				const index = Math.floor(z);
				if (z !== index && index < resolutions.length - 1) {
					const power = resolutions[index] / resolutions[index + 1];
					return resolutions[index] / Math.pow(power, z - index);
				} else {
					return resolutions[index];
				}
			} else {
				return undefined;
			}
		}
	);
}


/**
 * @param {number} power Power.
 * @param {number} maxResolution Maximum resolution.
 * @param {number=} opt_maxLevel Maximum level.
 * @return {module:ol/resolutionconstraint~Type} Zoom function.
 */
export function createSnapToPower(power: number, maxResolution: number, opt_maxLevel?: number) {
	return (
		/**
		 * @param {number|undefined} resolution Resolution.
		 * @param {number} delta Delta.
		 * @param {number} direction Direction.
		 * @return {number|undefined} Resolution.
		 */
		(resolution: number | undefined, delta: number, direction: number) => {
			if (resolution !== undefined) {
				const offset = -direction / 2 + 0.5;
				const oldLevel = Math.floor(
					Math.log(maxResolution / resolution) / Math.log(power) + offset);
				let newLevel = Math.max(oldLevel + delta, 0);
				if (opt_maxLevel !== undefined) {
					newLevel = Math.min(newLevel, opt_maxLevel);
				}
				return maxResolution / Math.pow(power, newLevel);
			} else {
				return undefined;
			}
		});
}
