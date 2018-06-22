/**
 * @module ol/asserts
 */
import AssertionError from './AssertionError';

/**
 * @param {*} assertion Assertion we expected to be truthy.
 * @param {number} errorCode Error code.
 */
export function assert(assertion: any, errorCode: number) {
	if (!assertion) {
		throw new AssertionError(errorCode);
	}
}
