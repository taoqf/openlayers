/**
 * @module ol/format/filter/Not
 */
import Filter from '../filter/Filter';

/**
 * @classdesc
 * Represents a logical `<Not>` operator for a filter condition.
 *
 * @constructor
 * @param {!module:ol/format/filter/Filter} condition Filter condition.
 * @extends {module:ol/format/filter/Filter}
 * @api
 */
export default class Not extends Filter {
	public condition: Filter;
	constructor(condition: Filter) {

		super('Not');

		/**
		 * @type {!module:ol/format/filter/Filter}
		 */
		this.condition = condition;
	}
}
