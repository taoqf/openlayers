/**
 * @module ol/format/filter/NotEqualTo
 */
import ComparisonBinary from '../filter/ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsNotEqualTo>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!(string|number)} expression The value to compare.
 * @param {boolean=} opt_matchCase Case-sensitive?
 * @extends {module:ol/format/filter/ComparisonBinary}
 * @api
 */
export default class NotEqualTo extends ComparisonBinary {
	constructor(propertyName: string, expression: string | number, opt_matchCase?: boolean) {
		super('PropertyIsNotEqualTo', propertyName, expression, opt_matchCase);
	}
}
