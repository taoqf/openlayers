/**
 * @module ol/format/filter/ComparisonBinary
 */
import Comparison from '../filter/Comparison';

/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Base class for WFS GetFeature property binary comparison filters.
 *
 * @constructor
 * @abstract
 * @param {!string} tagName The XML tag name for this filter.
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!(string|number)} expression The value to compare.
 * @param {boolean=} opt_matchCase Case-sensitive?
 * @extends {module:ol/format/filter/Comparison}
 */
export default class ComparisonBinary extends Comparison {
	public expression: string | number;
	public matchCase: boolean | undefined;
	constructor(tagName: string, propertyName: string, expression: string | number, opt_matchCase?: boolean) {
		super(tagName, propertyName);

		/**
		 * @type {!(string|number)}
		 */
		this.expression = expression;

		/**
		 * @type {boolean|undefined}
		 */
		this.matchCase = opt_matchCase;
	}
}
