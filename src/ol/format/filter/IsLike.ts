/**
 * @module ol/format/filter/IsLike
 */
import Comparison from '../filter/Comparison';

/**
 * @classdesc
 * Represents a `<PropertyIsLike>` comparison operator.
 *
 * @constructor
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!string} pattern Text pattern.
 * @param {string=} opt_wildCard Pattern character which matches any sequence of
 *    zero or more string characters. Default is '*'.
 * @param {string=} opt_singleChar pattern character which matches any single
 *    string character. Default is '.'.
 * @param {string=} opt_escapeChar Escape character which can be used to escape
 *    the pattern characters. Default is '!'.
 * @param {boolean=} opt_matchCase Case-sensitive?
 * @extends {module:ol/format/filter/Comparison}
 * @api
 */
export default class IsLike extends Comparison {
	public pattern: string;
	public wildCard: string;
	public singleChar: string;
	public escapeChar: string;
	public matchCase: boolean | undefined;
	constructor(propertyName: string, pattern: string, opt_wildCard?: string, opt_singleChar?: string, opt_escapeChar?: string, opt_matchCase?: boolean) {
		super('PropertyIsLike', propertyName);

		/**
		 * @type {!string}
		 */
		this.pattern = pattern;

		/**
		 * @type {!string}
		 */
		this.wildCard = (opt_wildCard !== undefined) ? opt_wildCard : '*';

		/**
		 * @type {!string}
		 */
		this.singleChar = (opt_singleChar !== undefined) ? opt_singleChar : '.';

		/**
		 * @type {!string}
		 */
		this.escapeChar = (opt_escapeChar !== undefined) ? opt_escapeChar : '!';

		/**
		 * @type {boolean|undefined}
		 */
		this.matchCase = opt_matchCase;
	}
}
