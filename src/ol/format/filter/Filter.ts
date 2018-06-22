/**
 * @module ol/format/filter/Filter
 */


/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Base class for WFS GetFeature filters.
 *
 * @constructor
 * @abstract
 * @param {!string} tagName The XML tag name for this filter.
 * @struct
 */
export default class Filter {
	private tagName: string;
	constructor(tagName: string) {
		/**
		 * @private
		 * @type {!string}
		 */
		this.tagName = tagName;
	}

	/**
	 * The XML tag name for a filter.
	 * @returns {!string} Name.
	 */
	public getTagName() {
		return this.tagName;
	}
}
