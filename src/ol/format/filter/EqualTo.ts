/**
 * @module ol/format/filter/EqualTo
 */
import ComparisonBinary from '../filter/ComparisonBinary';

/**
 * @classdesc
 * Represents a `<PropertyIsEqualTo>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!(string|number)} expression The value to compare.
 * @param {boolean=} opt_matchCase Case-sensitive?
 * @extends {module:ol/format/filter/ComparisonBinary}
 * @api
 */
export default class EqualTo extends ComparisonBinary {
	constructor(propertyName: string, expression: string | number, opt_matchCase?: boolean) {
		super('PropertyIsEqualTo', propertyName, expression, opt_matchCase);
	}
}
