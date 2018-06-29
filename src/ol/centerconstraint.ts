/**
 * @module ol/centerconstraint
 */
import { Coordinate } from './coordinate';
import { Extent } from './extent';
import { clamp } from './math';


/**
 * @typedef {function((module:ol/coordinate~Coordinate|undefined)): (module:ol/coordinate~Coordinate|undefined)} Type
 */

export type Type = (cor: Coordinate | undefined) => Coordinate | undefined;

/**
 * @param {module:ol/extent~Extent} extent Extent.
 * @return {module:ol/centerconstraint~Type} The constraint.
 */
export function createExtent(extent: Extent) {
	return (
		/**
		 * @param {module:ol/coordinate~Coordinate=} center Center.
		 * @return {module:ol/coordinate~Coordinate|undefined} Center.
		 */
		(center: Coordinate) => {
			if (center) {
				return [
					clamp(center[0], extent[0], extent[2]),
					clamp(center[1], extent[1], extent[3])
				] as Coordinate;
			} else {
				return undefined;
			}
		}
	);
}


/**
 * @param {module:ol/coordinate~Coordinate=} center Center.
 * @return {module:ol/coordinate~Coordinate|undefined} Center.
 */
export function none(center: Coordinate) {
	return center;
}
