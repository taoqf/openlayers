/**
 * @module ol/format/filter/GreaterThan
 */
import ComparisonBinary from '../filter/ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsGreaterThan>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @extends {module:ol/format/filter/ComparisonBinary}
 * @api
 */
export default class GreaterThan extends ComparisonBinary {
	constructor(propertyName: string, expression: number) {
		super('PropertyIsGreaterThan', propertyName, expression);
	}
}
