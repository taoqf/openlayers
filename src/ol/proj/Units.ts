/**
 * @module ol/proj/Units
 */

/**
 * Projection units: `'degrees'`, `'ft'`, `'m'`, `'pixels'`, `'tile-pixels'` or
 * `'us-ft'`.
 * @enum {string}
 */
enum Units {
	DEGREES = 'degrees',
	FEET = 'ft',
	METERS = 'm',
	PIXELS = 'pixels',
	TILE_PIXELS = 'tile-pixels',
	USFEET = 'us-ft'
}


/**
 * Meters per unit lookup table.
 * @const
 * @type {Object.<module:ol/proj/Units, number>}
 * @api
 */
export const METERS_PER_UNIT = {
	// use the radius of the Normal sphere
	[Units.DEGREES]: 2 * Math.PI * 6370997 / 360,
	[Units.FEET]: 0.3048,
	[Units.METERS]: 1,
	[Units.USFEET]: 1200 / 3937
} as {
		[unit: string]: number;
	};

export default Units;
