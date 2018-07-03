/**
 * @module ol/format/JSONFeature
 */
import FeatureFormat from '../format/Feature';
import FormatType from '../format/FormatType';

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for JSON feature formats.
 *
 * @constructor
 * @abstract
 * @extends {module:ol/format/Feature}
 */
export default class JSONFeature extends FeatureFormat {
	/**
	 * @inheritDoc
	 */
	public getType() {
		return FormatType.JSON;
	}


	/**
	 * @inheritDoc
	 */
	public readFeature(source, opt_options) {
		return this.readFeatureFromObject(
			getObject(source), this.getReadOptions(source, opt_options));
	}


	/**
	 * @inheritDoc
	 */
	public readFeatures(source, opt_options) {
		return this.readFeaturesFromObject(
			getObject(source), this.getReadOptions(source, opt_options));
	}

	/**
	 * @inheritDoc
	 */
	public readProjection(source) {
		return this.readProjectionFromObject(getObject(source));
	}

	/**
	 * @inheritDoc
	 */
	public writeFeature(feature, opt_options) {
		return JSON.stringify(this.writeFeatureObject(feature, opt_options));
	}


	/**
	 * @abstract
	 * @param {module:ol/Feature} feature Feature.
	 * @param {module:ol/format/Feature~WriteOptions=} opt_options Write options.
	 * @return {Object} Object.
	 */
	JSONFeature.prototype.writeFeatureObject = function (feature, opt_options) { };


	/**
	 * @inheritDoc
	 */
	public writeFeatures(features, opt_options) {
		return JSON.stringify(this.writeFeaturesObject(features, opt_options));
	}


	/**
	 * @abstract
	 * @param {Array.<module:ol/Feature>} features Features.
	 * @param {module:ol/format/Feature~WriteOptions=} opt_options Write options.
	 * @return {Object} Object.
	 */
	JSONFeature.prototype.writeFeaturesObject = function (features, opt_options) { };


	/**
	 * @inheritDoc
	 */
	public writeGeometry(geometry, opt_options) {
		return JSON.stringify(this.writeGeometryObject(geometry, opt_options));
	}


	/**
	 * @abstract
	 * @param {module:ol/geom/Geometry} geometry Geometry.
	 * @param {module:ol/format/Feature~WriteOptions=} opt_options Write options.
	 * @return {Object} Object.
	 */
	JSONFeature.prototype.writeGeometryObject = function (geometry, opt_options) { };


	/**
	 * @abstract
	 * @param {Object} object Object.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Read options.
	 * @protected
	 * @return {module:ol/Feature} Feature.
	 */
	protected readFeatureFromObject(object, opt_options) { }


	/**
	 * @abstract
	 * @param {Object} object Object.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Read options.
	 * @protected
	 * @return {Array.<module:ol/Feature>} Features.
	 */
	protected readFeaturesFromObject(object, opt_options) { }


	/**
	 * @inheritDoc
	 */
	public readGeometry(source, opt_options) {
		return this.readGeometryFromObject(
			getObject(source), this.getReadOptions(source, opt_options));
	}
	/**
	 * @abstract
	 * @param {Object} object Object.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Read options.
	 * @protected
	 * @return {module:ol/geom/Geometry} Geometry.
	 */
	protected readGeometryFromObject(object, opt_options) { }

	/**
	 * @abstract
	 * @param {Object} object Object.
	 * @protected
	 * @return {module:ol/proj/Projection} Projection.
	 */
	protected readProjectionFromObject(object) { }

}

/**
 * @param {Document|Node|Object|string} source Source.
 * @return {Object} Object.
 */
function getObject(source) {
	if (typeof source === 'string') {
		const object = JSON.parse(source);
		return object ? /** @type {Object} */ (object) : null;
	} else if (source !== null) {
		return source;
	} else {
		return null;
	}
}
