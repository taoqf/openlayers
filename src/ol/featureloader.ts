/**
 * @module ol/featureloader
 */
import { Extent } from './extent';
import Feature from './Feature';
import FeatureFormat from './format/Feature';
import FormatType from './format/FormatType';
import { UNDEFINED } from './functions';
import Projection from './proj/Projection';
import VectorSource from './source/Vector';
import VectorTile from './VectorTile';


/**
 * {@link module:ol/source/Vector} sources use a function of this type to
 * load features.
 *
 * This function takes an {@link module:ol/extent~Extent} representing the area to be loaded,
 * a `{number}` representing the resolution (map units per pixel) and an
 * {@link module:ol/proj/Projection} for the projection  as
 * arguments. `this` within the function is bound to the
 * {@link module:ol/source/Vector} it's called from.
 *
 * The function is responsible for loading the features and adding them to the
 * source.
 * @typedef {function(this:module:ol/source/Vector, module:ol/extent~Extent, number,
 *                    module:ol/proj/Projection)} FeatureLoader
 * @api
 */

export type FeatureLoader = (source: VectorSource, extent: Extent, n: number, proj: Projection) => void;

/**
 * {@link module:ol/source/Vector} sources use a function of this type to
 * get the url to load features from.
 *
 * This function takes an {@link module:ol/extent~Extent} representing the area
 * to be loaded, a `{number}` representing the resolution (map units per pixel)
 * and an {@link module:ol/proj/Projection} for the projection  as
 * arguments and returns a `{string}` representing the URL.
 * @typedef {function(module:ol/extent~Extent, number, module:ol/proj/Projection): string} FeatureUrlFunction
 * @api
 */

export type FeatureUrlFunction = (extent: Extent, n: number, proj: Projection) => string;

/**
 * @param {string|module:ol/featureloader~FeatureUrlFunction} url Feature URL service.
 * @param {module:ol/format/Feature} format Feature format.
 * @param {function(this:module:ol/VectorTile, Array.<module:ol/Feature>, module:ol/proj/Projection, module:ol/extent~Extent)|function(this:module:ol/source/Vector, Array.<module:ol/Feature>)} success
 *     Function called with the loaded features and optionally with the data
 *     projection. Called with the vector tile or source as `this`.
 * @param {function(this:module:ol/VectorTile)|function(this:module:ol/source/Vector)} failure
 *     Function called when loading failed. Called with the vector tile or
 *     source as `this`.
 * @return {module:ol/featureloader~FeatureLoader} The feature loader.
 */
export function loadFeaturesXhr(this: VectorSource, url: string | FeatureUrlFunction, format: FeatureFormat, success: ((this: VectorTile, features: Feature[], proj: Projection, extent: Extent) => void) | ((this: VectorSource, features: Feature[]) => void), failure: ((this: VectorTile) => void) | ((this: VectorSource) => void)) {
	return (
		/**
		 * @param {module:ol/extent~Extent} extent Extent.
		 * @param {number} resolution Resolution.
		 * @param {module:ol/proj/Projection} projection Projection.
		 * @this {module:ol/source/Vector|module:ol/VectorTile}
		 */
		(extent: Extent, resolution: number, projection: Projection) => {
			const _xhr = new XMLHttpRequest();
			_xhr.open('GET',
				typeof url === 'function' ? url(extent, resolution, projection) : url,
				true);
			if (format.getType() === FormatType.ARRAY_BUFFER) {
				_xhr.responseType = 'arraybuffer';
			}
			/**
			 * @param {Event} event Event.
			 * @private
			 */
			_xhr.onload = () => {
				// status will be 0 for file:// urls
				if (!_xhr.status || _xhr.status >= 200 && _xhr.status < 300) {
					const type = format.getType();
					/** @type {Document|Node|Object|string|undefined} */
					let source;
					if (type === FormatType.JSON || type === FormatType.TEXT) {
						source = _xhr.responseText;
					} else if (type === FormatType.XML) {
						source = _xhr.responseXML;
						if (!source) {
							source = new DOMParser().parseFromString(_xhr.responseText, 'application/xml');
						}
					} else if (type === FormatType.ARRAY_BUFFER) {
						source = /** @type {ArrayBuffer} */ (_xhr.response);
					}
					if (source) {
						success.call(this, format.readFeatures(source,
							{ featureProjection: projection }),
							format.readProjection(source), format.getLastExtent());
					} else {
						failure.call(this);
					}
				} else {
					failure.call(this);
				}
			};
			/**
			 * @private
			 */
			_xhr.onerror = () => {
				failure.call(this);
			};
			_xhr.send();
		}
	);
}


/**
 * Create an XHR feature loader for a `url` and `format`. The feature loader
 * loads features (with XHR), parses the features, and adds them to the
 * vector source.
 * @param {string|module:ol/featureloader~FeatureUrlFunction} url Feature URL service.
 * @param {module:ol/format/Feature} format Feature format.
 * @return {module:ol/featureloader~FeatureLoader} The feature loader.
 * @api
 */
export function xhr(url: string, format: FeatureFormat) {
	return loadFeaturesXhr(url, format,
		/**
		 * @param {Array.<module:ol/Feature>} features The loaded features.
		 * @param {module:ol/proj/Projection} dataProjection Data
		 * projection.
		 * @this {module:ol/source/Vector}
		 */
		(function (this: VectorSource, features: Feature[], _dataProjection) {
			this.addFeatures(features);
		}), /* FIXME handle error */ UNDEFINED);
}
