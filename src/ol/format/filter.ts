/**
 * @module ol/format/filter
 */
import { Extent } from '../extent';
import And from '../format/filter/And';
import Bbox from '../format/filter/Bbox';
import Contains from '../format/filter/Contains';
import During from '../format/filter/During';
import EqualTo from '../format/filter/EqualTo';
import GreaterThan from '../format/filter/GreaterThan';
import GreaterThanOrEqualTo from '../format/filter/GreaterThanOrEqualTo';
import Intersects from '../format/filter/Intersects';
import IsBetween from '../format/filter/IsBetween';
import IsLike from '../format/filter/IsLike';
import IsNull from '../format/filter/IsNull';
import LessThan from '../format/filter/LessThan';
import LessThanOrEqualTo from '../format/filter/LessThanOrEqualTo';
import Not from '../format/filter/Not';
import NotEqualTo from '../format/filter/NotEqualTo';
import Or from '../format/filter/Or';
import Within from '../format/filter/Within';
import Geometry from '../geom/Geometry';
import Filter from './filter/Filter';


/**
 * Create a logical `<And>` operator between two or more filter conditions.
 *
 * @param {...module:ol/format/filter/Filter} conditions Filter conditions.
 * @returns {!module:ol/format/filter/And} `<And>` operator.
 * @api
 */
export function and(...params: Filter[]) {
	return new And(...params);
}


/**
 * Create a logical `<Or>` operator between two or more filter conditions.
 *
 * @param {...module:ol/format/filter/Filter} conditions Filter conditions.
 * @returns {!module:ol/format/filter/Or} `<Or>` operator.
 * @api
 */
export function or(...params: Filter[]) {
	return new Or(...params);
}


/**
 * Represents a logical `<Not>` operator for a filter condition.
 *
 * @param {!module:ol/format/filter/Filter} condition Filter condition.
 * @returns {!module:ol/format/filter/Not} `<Not>` operator.
 * @api
 */
export function not(condition: Filter) {
	return new Not(condition);
}


/**
 * Create a `<BBOX>` operator to test whether a geometry-valued property
 * intersects a fixed bounding box
 *
 * @param {!string} geometryName Geometry name to use.
 * @param {!module:ol/extent~Extent} extent Extent.
 * @param {string=} opt_srsName SRS name. No srsName attribute will be
 *    set on geometries when this is not provided.
 * @returns {!module:ol/format/filter/Bbox} `<BBOX>` operator.
 * @api
 */
export function bbox(geometryName: string, extent: Extent, opt_srsName?: string) {
	return new Bbox(geometryName, extent, opt_srsName);
}

/**
 * Create a `<Contains>` operator to test whether a geometry-valued property
 * contains a given geometry.
 *
 * @param {!string} geometryName Geometry name to use.
 * @param {!module:ol/geom/Geometry} geometry Geometry.
 * @param {string=} opt_srsName SRS name. No srsName attribute will be
 *    set on geometries when this is not provided.
 * @returns {!module:ol/format/filter/Contains} `<Contains>` operator.
 * @api
 */
export function contains(geometryName: string, geometry: Geometry, opt_srsName?: string) {
	return new Contains(geometryName, geometry, opt_srsName);
}

/**
 * Create a `<Intersects>` operator to test whether a geometry-valued property
 * intersects a given geometry.
 *
 * @param {!string} geometryName Geometry name to use.
 * @param {!module:ol/geom/Geometry} geometry Geometry.
 * @param {string=} opt_srsName SRS name. No srsName attribute will be
 *    set on geometries when this is not provided.
 * @returns {!module:ol/format/filter/Intersects} `<Intersects>` operator.
 * @api
 */
export function intersects(geometryName: string, geometry: Geometry, opt_srsName?: string) {
	return new Intersects(geometryName, geometry, opt_srsName);
}

/**
 * Create a `<Within>` operator to test whether a geometry-valued property
 * is within a given geometry.
 *
 * @param {!string} geometryName Geometry name to use.
 * @param {!module:ol/geom/Geometry} geometry Geometry.
 * @param {string=} opt_srsName SRS name. No srsName attribute will be
 *    set on geometries when this is not provided.
 * @returns {!module:ol/format/filter/Within} `<Within>` operator.
 * @api
 */
export function within(geometryName: string, geometry: Geometry, opt_srsName?: string) {
	return new Within(geometryName, geometry, opt_srsName);
}


/**
 * Creates a `<PropertyIsEqualTo>` comparison operator.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!(string|number)} expression The value to compare.
 * @param {boolean=} opt_matchCase Case-sensitive?
 * @returns {!module:ol/format/filter/EqualTo} `<PropertyIsEqualTo>` operator.
 * @api
 */
export function equalTo(propertyName: string, expression: string | number, opt_matchCase?: boolean) {
	return new EqualTo(propertyName, expression, opt_matchCase);
}


/**
 * Creates a `<PropertyIsNotEqualTo>` comparison operator.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!(string|number)} expression The value to compare.
 * @param {boolean=} opt_matchCase Case-sensitive?
 * @returns {!module:ol/format/filter/NotEqualTo} `<PropertyIsNotEqualTo>` operator.
 * @api
 */
export function notEqualTo(propertyName: string, expression: string | number, opt_matchCase?: boolean) {
	return new NotEqualTo(propertyName, expression, opt_matchCase);
}


/**
 * Creates a `<PropertyIsLessThan>` comparison operator.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @returns {!module:ol/format/filter/LessThan} `<PropertyIsLessThan>` operator.
 * @api
 */
export function lessThan(propertyName: string, expression: number) {
	return new LessThan(propertyName, expression);
}


/**
 * Creates a `<PropertyIsLessThanOrEqualTo>` comparison operator.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @returns {!module:ol/format/filter/LessThanOrEqualTo} `<PropertyIsLessThanOrEqualTo>` operator.
 * @api
 */
export function lessThanOrEqualTo(propertyName: string, expression: number) {
	return new LessThanOrEqualTo(propertyName, expression);
}


/**
 * Creates a `<PropertyIsGreaterThan>` comparison operator.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @returns {!module:ol/format/filter/GreaterThan} `<PropertyIsGreaterThan>` operator.
 * @api
 */
export function greaterThan(propertyName: string, expression: number) {
	return new GreaterThan(propertyName, expression);
}


/**
 * Creates a `<PropertyIsGreaterThanOrEqualTo>` comparison operator.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} expression The value to compare.
 * @returns {!module:ol/format/filter/GreaterThanOrEqualTo} `<PropertyIsGreaterThanOrEqualTo>` operator.
 * @api
 */
export function greaterThanOrEqualTo(propertyName: string, expression: number) {
	return new GreaterThanOrEqualTo(propertyName, expression);
}


/**
 * Creates a `<PropertyIsNull>` comparison operator to test whether a property value
 * is null.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @returns {!module:ol/format/filter/IsNull} `<PropertyIsNull>` operator.
 * @api
 */
export function isNull(propertyName: string) {
	return new IsNull(propertyName);
}


/**
 * Creates a `<PropertyIsBetween>` comparison operator to test whether an expression
 * value lies within a range given by a lower and upper bound (inclusive).
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!number} lowerBoundary The lower bound of the range.
 * @param {!number} upperBoundary The upper bound of the range.
 * @returns {!module:ol/format/filter/IsBetween} `<PropertyIsBetween>` operator.
 * @api
 */
export function between(propertyName: string, lowerBoundary: number, upperBoundary: number) {
	return new IsBetween(propertyName, lowerBoundary, upperBoundary);
}


/**
 * Represents a `<PropertyIsLike>` comparison operator that matches a string property
 * value against a text pattern.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!string} pattern Text pattern.
 * @param {string=} opt_wildCard Pattern character which matches any sequence of
 *    zero or more string characters. Default is '*'.
 * @param {string=} opt_singleChar pattern character which matches any single
 *    string character. Default is '.'.
 * @param {string=} opt_escapeChar Escape character which can be used to escape
 *    the pattern characters. Default is '!'.
 * @param {boolean=} opt_matchCase Case-sensitive?
 * @returns {!module:ol/format/filter/IsLike} `<PropertyIsLike>` operator.
 * @api
 */
export function like(propertyName: string, pattern: string, opt_wildCard?: string, opt_singleChar?: string, opt_escapeChar?: string, opt_matchCase?: boolean) {
	return new IsLike(propertyName, pattern,
		opt_wildCard, opt_singleChar, opt_escapeChar, opt_matchCase);
}


/**
 * Create a `<During>` temporal operator.
 *
 * @param {!string} propertyName Name of the context property to compare.
 * @param {!string} begin The begin date in ISO-8601 format.
 * @param {!string} end The end date in ISO-8601 format.
 * @returns {!module:ol/format/filter/During} `<During>` operator.
 * @api
 */
export function during(propertyName: string, begin: string, end: string) {
	return new During(propertyName, begin, end);
}
