/**
 * @module ol/format/filter/LogicalNary
 */
import { assert } from '../../asserts';
import Filter from '../filter/Filter';

/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Base class for WFS GetFeature n-ary logical filters.
 *
 * @constructor
 * @abstract
 * @param {!string} tagName The XML tag name for this filter.
 * @param {...module:ol/format/filter/Filter} conditions Conditions.
 * @extends {module:ol/format/filter/Filter}
 */
export default class LogicalNary extends Filter {
	/**
	 * @type {Array.<module:ol/format/filter/Filter>}
	 */
	public conditions: Filter[];
	constructor(tagName: string, ...conditions: Filter[]) {
		super(tagName);
		this.conditions = conditions;
		assert(this.conditions.length >= 2, 57); // At least 2 conditions are required.
	}
}
