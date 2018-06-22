/**
 * @module ol/format/filter/Contains
 */
import Geometry from '../../geom/Geometry';
import Spatial from '../filter/Spatial';

/**
 * @classdesc
 * Represents a `<Contains>` operator to test whether a geometry-valued property
 * contains a given geometry.
 *
 * @constructor
 * @param {!string} geometryName Geometry name to use.
 * @param {!module:ol/geom/Geometry} geometry Geometry.
 * @param {string=} opt_srsName SRS name. No srsName attribute will be
 *    set on geometries when this is not provided.
 * @extends {module:ol/format/filter/Spatial}
 * @api
 */
export default class Contains extends Spatial {
	constructor(geometryName: string, geometry: Geometry, opt_srsName?: string) {
		super('Contains', geometryName, geometry, opt_srsName);
	}
}
