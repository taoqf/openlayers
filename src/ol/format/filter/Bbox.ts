/**
 * @module ol/format/filter/Bbox
 */
import { Extent } from '../../extent';
import Filter from '../filter/Filter';

/**
 * @classdesc
 * Represents a `<BBOX>` operator to test whether a geometry-valued property
 * intersects a fixed bounding box
 * @extends {module:ol/format/filter/Filter}
 * @api
 */
export default class Bbox extends Filter {
	public geometryName: string;
	public extent: [number, number, number, number];
	public srsName: string | undefined;

	/**
	 * @constructor
	 * @param {!string} geometryName Geometry name to use.
	 * @param {!module:ol/extent~Extent} extent Extent.
	 * @param {string=} opt_srsName SRS name. No srsName attribute will be
	 *    set on geometries when this is not provided.
	 * @api
	 */
	constructor(geometryName: string, extent: Extent, opt_srsName?: string) {

		super('BBOX');

		/**
		 * @type {!string}
		 */
		this.geometryName = geometryName;

		/**
		 * @type {module:ol/extent~Extent}
		 */
		this.extent = extent;

		/**
		 * @type {string|undefined}
		 */
		this.srsName = opt_srsName;
	}
}
