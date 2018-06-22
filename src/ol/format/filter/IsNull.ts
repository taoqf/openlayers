/**
 * @module ol/format/filter/IsNull
 */
import Comparison from '../filter/Comparison';

/**
 * @classdesc
 * Represents a `<PropertyIsNull>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @extends {module:ol/format/filter/Comparison}
 * @api
 */
export default class IsNull extends Comparison {
	constructor(propertyName: string) {
		super('PropertyIsNull', propertyName);
	}
}
