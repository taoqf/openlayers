/**
 * @module ol/proj/proj4
 */
import { Coordinate } from '../coordinate';
import { addCoordinateTransforms, addEquivalentProjections, addProjection, get, TransformFunction } from '../proj';
import Projection from './Projection';
import { get as getTransform } from './transforms';
import Units from './Units';

/**
 * Make projections defined in proj4 (with `proj4.defs()`) available in
 * OpenLayers.
 *
 * This function should be called whenever changes are made to the proj4
 * registry, e.g. after calling `proj4.defs()`. Existing transforms will not be
 * modified by this function.
 *
 * @param {?} proj4 Proj4.
 * @api
 */
export function register(proj4: {
	defs: {
		[code: string]: TransformFunction;
		(code: string): {
			axis: string;
			to_meter: number;
			units: Units;
		}
	};
	(code1: string, code2: string): {
		forward(pt: Coordinate): Coordinate;
		inverse(pt: Coordinate): Coordinate;
	};
}) {
	const projCodes = Object.keys(proj4.defs);
	const len = projCodes.length;
	for (let i = 0; i < len; ++i) {
		const code = projCodes[i];
		if (!get(code)) {
			const def = proj4.defs(code);
			addProjection(new Projection({
				axisOrientation: def.axis,
				code,
				metersPerUnit: def.to_meter,
				units: def.units
			}));
		}
	}
	for (let i = 0; i < len; ++i) {
		const code1 = projCodes[i];
		const proj1 = get(code1);
		for (let j = 0; j < len; ++j) {
			const code2 = projCodes[j];
			const proj2 = get(code2);
			if (!getTransform(code1, code2)) {
				if (proj4.defs[code1] === proj4.defs[code2]) {
					addEquivalentProjections([proj1!, proj2!]);
				} else {
					const transform = proj4(code1, code2);
					addCoordinateTransforms(proj1!, proj2!, transform.forward, transform.inverse);
				}
			}
		}
	}
}
