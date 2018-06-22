/**
 * @module ol/format/filter/LessThanOrEqualTo
 */
import ComparisonBinary from '../filter/ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsLessThanOrEqualTo>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @extends {module:ol/format/filter/ComparisonBinary}
 * @api
 */
export default class LessThanOrEqualTo extends ComparisonBinary {
	constructor(propertyName: string, expression: number) {
		super('PropertyIsLessThanOrEqualTo', propertyName, expression);
	}
}
