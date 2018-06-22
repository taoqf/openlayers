/**
 * @module ol/format/filter/And
 */
import LogicalNary from '../filter/LogicalNary';
import Filter from './Filter';

/**
 * @classdesc
 * Represents a logical `<And>` operator between two or more filter conditions.
 *
 * @constructor
 * @abstract
 * @param {...module:ol/format/filter/Filter} conditions Conditions.
 * @extends {module:ol/format/filter/LogicalNary}
 */
export default class And extends LogicalNary {
	constructor(...conditions: Filter[]) {
		super('And', ...conditions);
	}
}
