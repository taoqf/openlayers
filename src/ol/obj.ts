/**
 * @module ol/obj
 */


/**
 * Polyfill for Object.assign().  Assigns enumerable and own properties from
 * one or more source objects to a target object.
 *
 * @see https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
 * @param {!Object} target The target object.
 * @param {...Object} var_sources The source object(s).
 * @return {!Object} The modified target object.
 */
export const assign = (typeof Object.assign === 'function') ? Object.assign : (target: any, ...sources: any[]) => {
	if (target === undefined || target === null) {
		throw new TypeError('Cannot convert undefined or null to object');
	}

	const output = Object(target);
	sources.forEach((source) => {
		if (source !== undefined && source !== null) {
			for (const key in source) {
				if (source.hasOwnProperty(key)) {
					output[key] = source[key];
				}
			}
		}
	});
	return output;
};


/**
 * Removes all properties from an object.
 * @param {Object} object The object to clear.
 */
export function clear(object: { [index: string]: any; }) {
	for (const property in object) {
		if (object.hasOwnProperty(property)) {
			delete object[property];
		}
	}
}


/**
 * Get an array of property values from an object.
 * @param {Object<K,V>} object The object from which to get the values.
 * @return {!Array<V>} The property values.
 * @template K,V
 */
export function getValues(object: { [index: string]: any; }) {
	const values = [];
	for (const property in object) {
		if (object.hasOwnProperty(property)) {
			values.push(object[property]);
		}
	}
	return values;
}


/**
 * Determine if an object has any properties.
 * @param {Object} object The object to check.
 * @return {boolean} The object is empty.
 */
export function isEmpty(object: { [index: string]: any; }) {
	let property;
	for (property in object) {
		if (object.hasOwnProperty(property)) {
			return false;
		}
	}
	return !property;
}