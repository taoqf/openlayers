/**
 * @module ol/format/filter/IsBetween
 */
import Comparison from '../filter/Comparison';

/**
 * @classdesc
 * Represents a `<PropertyIsBetween>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} lowerBoundary The lower bound of the range.
 * @param {!number} upperBoundary The upper bound of the range.
 * @extends {module:ol/format/filter/Comparison}
 * @api
 */
export default class IsBetween extends Comparison {
	public lowerBoundary: number;
	public upperBoundary: number;
	constructor(propertyName: string, lowerBoundary: number, upperBoundary: number) {
		super('PropertyIsBetween', propertyName);

		/**
		 * @type {!number}
		 */
		this.lowerBoundary = lowerBoundary;

		/**
		 * @type {!number}
		 */
		this.upperBoundary = upperBoundary;
	}
}
