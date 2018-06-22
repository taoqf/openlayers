import Projection from './Projection';

/**
 * @module ol/proj/projections
 */


/**
 * @type {Object.<string, module:ol/proj/Projection>}
 */
let cache = {} as { [code: string]: Projection };


/**
 * Clear the projections cache.
 */
export function clear() {
	cache = {};
}


/**
 * Get a cached projection by code.
 * @param {string} code The code for the projection.
 * @return {module:ol/proj/Projection} The projection (if cached).
 */
export function get(code: string) {
	return cache[code] || null;
}


/**
 * Add a projection to the cache.
 * @param {string} code The projection code.
 * @param {module:ol/proj/Projection} projection The projection to cache.
 */
export function add(code: string, projection: Projection) {
	cache[code] = projection;
}
