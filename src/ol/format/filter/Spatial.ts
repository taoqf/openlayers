/**
 * @module ol/format/filter/Spatial
 */
import Geometry from '../../geom/Geometry';
import Filter from '../filter/Filter';

/**
 * @classdesc
 * Abstract class; normally only used for creating subclasses and not instantiated in apps.
 * Represents a spatial operator to test whether a geometry-valued property
 * relates to a given geometry.
 *
 * @constructor
 * @abstract
 * @param {!string} tagName The XML tag name for this filter.
 * @param {!string} geometryName Geometry name to use.
 * @param {!module:ol/geom/Geometry} geometry Geometry.
 * @param {string=} opt_srsName SRS name. No srsName attribute will be
 *    set on geometries when this is not provided.
 * @extends {module:ol/format/filter/Filter}
 */
export default class Spatial extends Filter {
	public geometryName: any;
	public geometry: Geometry;
	public srsName: any;
	constructor(tagName: string, geometryName: string, geometry: Geometry, opt_srsName?: string) {

		super(tagName);

		/**
		 * @type {!string}
		 */
		this.geometryName = geometryName || 'the_geom';

		/**
		 * @type {module:ol/geom/Geometry}
		 */
		this.geometry = geometry;

		/**
		 * @type {string|undefined}
		 */
		this.srsName = opt_srsName;
	}
}
