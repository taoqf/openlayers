/**
 * @module ol/format/filter/GreaterThanOrEqualTo
 */
import ComparisonBinary from '../filter/ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsGreaterThanOrEqualTo>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @extends {module:ol/format/filter/ComparisonBinary}
 * @api
 */
export default class GreaterThanOrEqualTo extends ComparisonBinary {
	constructor(propertyName: string, expression: number) {
		super('PropertyIsGreaterThanOrEqualTo', propertyName, expression);
	}
}
