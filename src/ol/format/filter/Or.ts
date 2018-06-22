/**
 * @module ol/format/filter/Or
 */
import LogicalNary from '../filter/LogicalNary';
import Filter from './Filter';

/**
 * @classdesc
 * Represents a logical `<Or>` operator between two ore more filter conditions.
 *
 * @constructor
 * @param {...module:ol/format/filter/Filter} conditions Conditions.
 * @extends {module:ol/format/filter/LogicalNary}
 * @api
 */
export default class Or extends LogicalNary {
	constructor(...conditions: Filter[]) {
		super('Or', ...conditions);
	}
}
