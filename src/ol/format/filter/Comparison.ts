/**
 * @module ol/format/filter/Comparison
 */
import Filter from '../filter/Filter';

/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Base class for WFS GetFeature property comparison filters.
 *
 * @constructor
 * @abstract
 * @param {!string} tagName The XML tag name for this filter.
 * @param {!string} propertyName Name of the context property to compare.
 * @extends {module:ol/format/filter/Filter}
 */
export default class Comparison extends Filter {
	/**
	 * @type {!string}
	 */
	public propertyName: string;
	constructor(tagName: string, propertyName: string) {

		super(tagName);

		this.propertyName = propertyName;
	}
}
