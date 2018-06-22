/**
 * @module ol/format/filter/LessThan
 */
import ComparisonBinary from '../filter/ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsLessThan>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @extends {module:ol/format/filter/ComparisonBinary}
 * @api
 */
export default class LessThan extends ComparisonBinary {
	constructor(propertyName: string, expression: number) {
		super('PropertyIsLessThan', propertyName, expression);
	}
}
