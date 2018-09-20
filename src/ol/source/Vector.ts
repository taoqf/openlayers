/**
 * @module ol/source/Vector
 */

import { extend } from '../array';
import { assert } from '../asserts';
import Collection, { CollectionEvent } from '../Collection';
import CollectionEventType from '../CollectionEventType';
import { Coordinate } from '../coordinate';
import { EventsKey, listen, unlistenByKey } from '../events';
import Event from '../events/Event';
import EventType from '../events/EventType';
import { containsExtent, equals, Extent } from '../extent';
import Feature from '../Feature';
import xhr, { FeatureLoader, FeatureUrlFunction } from '../featureloader';
import FeatureFormat from '../format/Feature';
import { TRUE, UNDEFINED } from '../functions';
import { getUid } from '../index';
import { all as allStrategy } from '../loadingstrategy';
import { getValues, isEmpty } from '../obj';
import ObjectEventType from '../ObjectEventType';
import Projection from '../proj/Projection';
import Source, { AttributionLike } from '../source/Source';
import SourceState from '../source/State';
import VectorEventType from '../source/VectorEventType';
import RBush from '../structs/RBush';

/**
 * A function that takes an {@link module:ol/extent~Extent} and a resolution as arguments, and
 * returns an array of {@link module:ol/extent~Extent} with the extents to load. Usually this
 * is one of the standard {@link module:ol/loadingstrategy} strategies.
 *
 * @typedef {function(module:ol/extent~Extent, number): Array.<module:ol/extent~Extent>} LoadingStrategy
 * @api
 */

export type LoadingStrategy = (extent: Extent, n: number) => Extent[];

/**
 * @classdesc
 * Events emitted by {@link module:ol/source/Vector} instances are instances of this
 * type.
 *
 * @constructor
 * @extends {module:ol/events/Event}
 * @param {string} type Type.
 * @param {module:ol/Feature=} opt_feature Feature.
 */
export class VectorSourceEvent extends Event {
	public feature: Feature | undefined;
	constructor(type: string, opt_feature?: Feature) {

		super(type);

		/**
		 * The feature being added or removed.
		 * @type {module:ol/Feature|undefined}
		 * @api
		 */
		this.feature = opt_feature;
	}
}


/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {Array.<module:ol/Feature>|module:ol/Collection.<module:ol/Feature>} [features]
 * Features. If provided as {@link module:ol/Collection}, the features in the source
 * and the collection will stay in sync.
 * @property {module:ol/format/Feature} [format] The feature format used by the XHR
 * feature loader when `url` is set. Required if `url` is set, otherwise ignored.
 * @property {module:ol/featureloader~FeatureLoader} [loader]
 * The loader function used to load features, from a remote source for example.
 * If this is not set and `url` is set, the source will create and use an XHR
 * feature loader.
 *
 * Example:
 *
 * ```js
 * import {Vector} from 'ol/source';
 * import {GeoJSON} from 'ol/format';
 * import {bbox} from 'ol/loadingstrategy';
 *
 * var vectorSource = new Vector({
 *   format: new GeoJSON(),
 *   loader: function(extent, resolution, projection) {
 *      var proj = projection.getCode();
 *      var url = 'https://ahocevar.com/geoserver/wfs?service=WFS&' +
 *          'version=1.1.0&request=GetFeature&typename=osm:water_areas&' +
 *          'outputFormat=application/json&srsname=' + proj + '&' +
 *          'bbox=' + extent.join(',') + ',' + proj;
 *      var xhr = new XMLHttpRequest();
 *      xhr.open('GET', url);
 *      var onError = function() {
 *        vectorSource.removeLoadedExtent(extent);
 *      }
 *      xhr.onerror = onError;
 *      xhr.onload = function() {
 *        if (xhr.status == 200) {
 *          vectorSource.addFeatures(
 *              vectorSource.getFormat().readFeatures(xhr.responseText));
 *        } else {
 *          onError();
 *        }
 *      }
 *      xhr.send();
 *    },
 *    strategy: bbox
 *  });
 * ```
 * @property {boolean} [overlaps=true] This source may have overlapping geometries.
 * Setting this to `false` (e.g. for sources with polygons that represent administrative
 * boundaries or TopoJSON sources) allows the renderer to optimise fill and
 * stroke operations.
 * @property {module:ol/source/Vector~LoadingStrategy} [strategy] The loading strategy to use.
 * By default an {@link module:ol/loadingstrategy~all}
 * strategy is used, a one-off strategy which loads all features at once.
 * @property {string|module:ol/featureloader~FeatureUrlfunction} [url]
 * Setting this option instructs the source to load features using an XHR loader
 * (see {@link module:ol/featureloader~xhr}). Use a `string` and an
 * {@link module:ol/loadingstrategy~all} for a one-off download of all features from
 * the given URL. Use a {@link module:ol/featureloader~FeatureUrlfunction} to generate the url with
 * other loading strategies.
 * Requires `format` to be set as well.
 * When default XHR feature loader is provided, the features will
 * be transformed from the data projection to the view projection
 * during parsing. If your remote data source does not advertise its projection
 * properly, this transformation will be incorrect. For some formats, the
 * default projection (usually EPSG:4326) can be overridden by setting the
 * defaultDataProjection constructor option on the format.
 * Note that if a source contains non-feature data, such as a GeoJSON geometry
 * or a KML NetworkLink, these will be ignored. Use a custom loader to load these.
 * @property {boolean} [useSpatialIndex=true]
 * By default, an RTree is used as spatial index. When features are removed and
 * added frequently, and the total number of features is low, setting this to
 * `false` may improve performance.
 *
 * Note that
 * {@link module:ol/source/Vector~VectorSource#getFeaturesInExtent},
 * {@link module:ol/source/Vector~VectorSource#getClosestFeatureToCoordinate} and
 * {@link module:ol/source/Vector~VectorSource#getExtent} cannot be used when `useSpatialIndex` is
 * set to `false`, and {@link module:ol/source/Vector~VectorSource#forEachFeatureInExtent} will loop
 * through all features.
 *
 * When set to `false`, the features will be maintained in an
 * {@link module:ol/Collection}, which can be retrieved through
 * {@link module:ol/source/Vector~VectorSource#getFeaturesCollection}.
 * @property {boolean} [wrapX=true] Wrap the world horizontally. For vector editing across the
 * -180° and 180° meridians to work properly, this should be set to `false`. The
 * resulting geometry coordinates will then exceed the world bounds.
 */

export interface Options {
	attributions: AttributionLike;
	features: Feature[] | Collection<Feature>;
	format: FeatureFormat;
	loader: FeatureLoader;
	overlaps: boolean;
	strategy: LoadingStrategy;
	url: string | FeatureUrlFunction;
	useSpatialIndex: boolean;
	wrapX: boolean;
}

/**
 * @classdesc
 * Provides a source of features for vector layers. Vector features provided
 * by this source are suitable for editing. See {@link module:ol/source/VectorTile~VectorTile} for
 * vector data that is optimized for rendering.
 *
 * @constructor
 * @extends {module:ol/source/Source}
 * @fires ol/source/Vector~VectorSourceEvent
 * @param {module:ol/source/Vector~Options=} opt_options Vector source options.
 * @api
 */
export default class VectorSource extends Source {
	private loader_: FeatureLoader;
	private format_: FeatureFormat;
	private overlaps_: boolean;
	private url_: string | FeatureUrlFunction;
	private strategy_: LoadingStrategy;
	private featuresRtree_: RBush<Feature> | null;
	private loadedExtentsRtree_: RBush<{ extent: Extent }>;
	private nullGeometryFeatures_: { [id: string]: Feature; };
	private idIndex_: { [id: string]: Feature; };
	private undefIdIndex_: { [id: string]: Feature; };
	private featureChangeKeys_: { [id: string]: EventsKey[]; };
	private featuresCollection_: Collection<Feature> | null;
	constructor(opt_options: Partial<Options>) {
		const options = opt_options || {};
		super({
			attributions: options.attributions,
			projection: undefined,
			state: SourceState.READY,
			wrapX: options.wrapX !== undefined ? options.wrapX : true
		});

		/**
		 * @private
		 * @type {module:ol/featureloader~FeatureLoader}
		 */
		this.loader_ = UNDEFINED;

		/**
		 * @private
		 * @type {module:ol/format/Feature|undefined}
		 */
		this.format_ = options.format!;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.overlaps_ = options.overlaps === undefined ? true : options.overlaps;

		/**
		 * @private
		 * @type {string|module:ol/featureloader~FeatureUrlFunction|undefined}
		 */
		this.url_ = options.url!;

		if (options.loader !== undefined) {
			this.loader_ = options.loader;
		} else if (this.url_ !== undefined) {
			assert(this.format_, 7); // `format` must be set when `url` is set
			// create a XHR feature loader for "url" and "format"
			this.loader_ = xhr(this.url_, /** @type {module:ol/format/Feature} */(this.format_), (loadedFeatures) => {
				this.addFeatures(loadedFeatures);
			});
		}

		/**
		 * @private
		 * @type {module:ol/source/Vector~LoadingStrategy}
		 */
		this.strategy_ = options.strategy !== undefined ? options.strategy : allStrategy;

		const useSpatialIndex =
			options.useSpatialIndex !== undefined ? options.useSpatialIndex : true;

		/**
		 * @private
		 * @type {module:ol/structs/RBush.<module:ol/Feature>}
		 */
		this.featuresRtree_ = useSpatialIndex ? new RBush<Feature>() : null;

		/**
		 * @private
		 * @type {module:ol/structs/RBush.<{extent: module:ol/extent~Extent}>}
		 */
		this.loadedExtentsRtree_ = new RBush();

		/**
		 * @private
		 * @type {!Object.<string, module:ol/Feature>}
		 */
		this.nullGeometryFeatures_ = {};

		/**
		 * A lookup of features by id (the return from feature.getId()).
		 * @private
		 * @type {!Object.<string, module:ol/Feature>}
		 */
		this.idIndex_ = {};

		/**
		 * A lookup of features without id (keyed by getUid(feature)).
		 * @private
		 * @type {!Object.<string, module:ol/Feature>}
		 */
		this.undefIdIndex_ = {};

		/**
		 * @private
		 * @type {Object.<string, Array.<module:ol/events~EventsKey>>}
		 */
		this.featureChangeKeys_ = {};

		/**
		 * @private
		 * @type {module:ol/Collection.<module:ol/Feature>}
		 */
		this.featuresCollection_ = null;

		let collection;
		let features;
		if (options.features instanceof Collection) {
			collection = options.features;
			features = collection.getArray();
		} else if (Array.isArray(options.features)) {
			features = options.features;
		}
		if (!useSpatialIndex && collection === undefined) {
			collection = new Collection<Feature>(features);
		}
		if (features !== undefined) {
			this.addFeaturesInternal(features);
		}
		if (collection !== undefined) {
			this.bindFeaturesCollection_(collection);
		}
	}

	/**
	 * Add a single feature to the source.  If you want to add a batch of features
	 * at once, call {@link module:ol/source/Vector~VectorSource#addFeatures #addFeatures()}
	 * instead. A feature will not be added to the source if feature with
	 * the same id is already there. The reason for this behavior is to avoid
	 * feature duplication when using bbox or tile loading strategies.
	 * @param {module:ol/Feature} feature Feature to add.
	 * @api
	 */
	public addFeature(feature: Feature) {
		this.addFeatureInternal(feature);
		this.changed();
	}


	/**
	 * Add a feature without firing a `change` event.
	 * @param {module:ol/Feature} feature Feature.
	 * @protected
	 */
	public addFeatureInternal(feature: Feature) {
		const featureKey = getUid(feature).toString();

		if (!this.addToIndex_(featureKey, feature)) {
			return;
		}

		this.setupChangeEvents_(featureKey, feature);

		const geometry = feature.getGeometry();
		if (geometry) {
			const extent = geometry.getExtent();
			if (this.featuresRtree_) {
				this.featuresRtree_.insert(extent, feature);
			}
		} else {
			this.nullGeometryFeatures_[featureKey] = feature;
		}

		this.dispatchEvent(
			new VectorSourceEvent(VectorEventType.ADDFEATURE, feature));
	}

	/**
	 * Add a batch of features to the source.
	 * @param {Array.<module:ol/Feature>} features Features to add.
	 * @api
	 */
	public addFeatures(features: Feature[]) {
		this.addFeaturesInternal(features);
		this.changed();
	}

	/**
	 * Remove all features from the source.
	 * @param {boolean=} opt_fast Skip dispatching of {@link module:ol/source/Vector~VectorSourceEvent#removefeature} events.
	 * @api
	 */
	public clear(opt_fast?: boolean) {
		if (opt_fast) {
			Object.keys(this.featureChangeKeys_).forEach((featureId) => {
				const keys = this.featureChangeKeys_[featureId];
				keys.forEach(unlistenByKey);
			});
			if (!this.featuresCollection_) {
				this.featureChangeKeys_ = {};
				this.idIndex_ = {};
				this.undefIdIndex_ = {};
			}
		} else {
			if (this.featuresRtree_) {
				this.featuresRtree_.forEach(this.removeFeatureInternal, this);
				Object.keys(this.nullGeometryFeatures_).forEach((id) => {
					this.removeFeatureInternal(this.nullGeometryFeatures_[id]);
				});
			}
		}
		if (this.featuresCollection_) {
			this.featuresCollection_.clear();
		}

		if (this.featuresRtree_) {
			this.featuresRtree_.clear();
		}
		this.loadedExtentsRtree_.clear();
		this.nullGeometryFeatures_ = {};

		const clearEvent = new VectorSourceEvent(VectorEventType.CLEAR);
		this.dispatchEvent(clearEvent);
		this.changed();
	}


	/**
	 * Iterate through all features on the source, calling the provided callback
	 * with each one.  If the callback returns any "truthy" value, iteration will
	 * stop and the function will return the same value.
	 * Note: this function only iterate through the feature that have a defined geometry.
	 *
	 * @param {function(module:ol/Feature): T} callback Called with each feature
	 *     on the source.  Return a truthy value to stop iteration.
	 * @return {T|undefined} The return value from the last call to the callback.
	 * @template T
	 * @api
	 */
	public forEachFeature<T>(callback: (feature: Feature) => T) {
		if (this.featuresRtree_) {
			return this.featuresRtree_.forEach(callback);
		} else if (this.featuresCollection_) {
			return this.featuresCollection_.forEach(callback);
		}
	}


	/**
	 * Iterate through all features whose geometries contain the provided
	 * coordinate, calling the callback with each feature.  If the callback returns
	 * a "truthy" value, iteration will stop and the function will return the same
	 * value.
	 *
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {function(module:ol/Feature): T} callback Called with each feature
	 *     whose goemetry contains the provided coordinate.
	 * @return {T|undefined} The return value from the last call to the callback.
	 * @template T
	 */
	public forEachFeatureAtCoordinateDirect<T>(coordinate: Coordinate, callback: (feature: Feature) => T) {
		const extent = [coordinate[0], coordinate[1], coordinate[0], coordinate[1]] as Extent;
		return this.forEachFeatureInExtent(extent, (feature) => {
			const geometry = feature.getGeometry();
			if (geometry.intersectsCoordinate(coordinate)) {
				return callback(feature);
			} else {
				return undefined;
			}
		});
	}


	/**
	 * Iterate through all features whose bounding box intersects the provided
	 * extent (note that the feature's geometry may not intersect the extent),
	 * calling the callback with each feature.  If the callback returns a "truthy"
	 * value, iteration will stop and the function will return the same value.
	 *
	 * If you are interested in features whose geometry intersects an extent, call
	 * the {@link module:ol/source/Vector~VectorSource#forEachFeatureIntersectingExtent #forEachFeatureIntersectingExtent()} method instead.
	 *
	 * When `useSpatialIndex` is set to false, this method will loop through all
	 * features, equivalent to {@link module:ol/source/Vector~VectorSource#forEachFeature #forEachFeature()}.
	 *
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {function(module:ol/Feature): T} callback Called with each feature
	 *     whose bounding box intersects the provided extent.
	 * @return {T|undefined} The return value from the last call to the callback.
	 * @template T
	 * @api
	 */
	public forEachFeatureInExtent<S, T>(extent: Extent, callback: (this: S, feature: Feature) => T | undefined | void, opt_this?: S) {
		if (this.featuresRtree_) {
			return this.featuresRtree_.forEachInExtent(extent, callback, opt_this);
		} else if (this.featuresCollection_) {
			return this.featuresCollection_.forEach(callback.bind(opt_this));
		}
	}

	/**
	 * Iterate through all features whose geometry intersects the provided extent,
	 * calling the callback with each feature.  If the callback returns a "truthy"
	 * value, iteration will stop and the function will return the same value.
	 *
	 * If you only want to test for bounding box intersection, call the
	 * {@link module:ol/source/Vector~VectorSource#forEachFeatureInExtent #forEachFeatureInExtent()} method instead.
	 *
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {function(module:ol/Feature): T} callback Called with each feature
	 *     whose geometry intersects the provided extent.
	 * @return {T|undefined} The return value from the last call to the callback.
	 * @template T
	 * @api
	 */
	public forEachFeatureIntersectingExtent<T>(extent: Extent, callback: (feature: Feature) => T) {
		return this.forEachFeatureInExtent(extent,
			/**
			 * @param {module:ol/Feature} feature Feature.
			 * @return {T|undefined} The return value from the last call to the callback.
			 * @template T
			 */
			(feature) => {
				const geometry = feature.getGeometry();
				if (geometry.intersectsExtent(extent)) {
					const result = callback(feature);
					if (result) {
						return result;
					} else {
						return undefined;
					}
				} else {
					return undefined;
				}
			});
	}


	/**
	 * Get the features collection associated with this source. Will be `null`
	 * unless the source was configured with `useSpatialIndex` set to `false`, or
	 * with an {@link module:ol/Collection} as `features`.
	 * @return {module:ol/Collection.<module:ol/Feature>} The collection of features.
	 * @api
	 */
	public getFeaturesCollection() {
		return this.featuresCollection_;
	}


	/**
	 * Get all features on the source in random order.
	 * @return {Array.<module:ol/Feature>} Features.
	 * @api
	 */
	public getFeatures() {
		let features;
		if (this.featuresCollection_) {
			features = this.featuresCollection_.getArray();
		} else if (this.featuresRtree_) {
			features = this.featuresRtree_.getAll();
			if (!isEmpty(this.nullGeometryFeatures_)) {
				extend(features, getValues(this.nullGeometryFeatures_));
			}
		}
		return (
		/** @type {Array.<module:ol/Feature>} */ (features)
		);
	}


	/**
	 * Get all features whose geometry intersects the provided coordinate.
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @return {Array.<module:ol/Feature>} Features.
	 * @api
	 */
	public getFeaturesAtCoordinate(coordinate: Coordinate) {
		const features = [] as Feature[];
		this.forEachFeatureAtCoordinateDirect(coordinate, (feature) => {
			features.push(feature);
		});
		return features;
	}


	/**
	 * Get all features in the provided extent.  Note that this returns an array of
	 * all features intersecting the given extent in random order (so it may include
	 * features whose geometries do not intersect the extent).
	 *
	 * This method is not available when the source is configured with
	 * `useSpatialIndex` set to `false`.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @return {Array.<module:ol/Feature>} Features.
	 * @api
	 */
	public getFeaturesInExtent(extent: Extent) {
		return this.featuresRtree_!.getInExtent(extent);
	}


	/**
	 * Get the closest feature to the provided coordinate.
	 *
	 * This method is not available when the source is configured with
	 * `useSpatialIndex` set to `false`.
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {function(module:ol/Feature):boolean=} opt_filter Feature filter function.
	 *     The filter function will receive one argument, the {@link module:ol/Feature feature}
	 *     and it should return a boolean value. By default, no filtering is made.
	 * @return {module:ol/Feature} Closest feature.
	 * @api
	 */
	public getClosestFeatureToCoordinate(coordinate: Coordinate, opt_filter?: (feature: Feature) => boolean) {
		// Find the closest feature using branch and bound.  We start searching an
		// infinite extent, and find the distance from the first feature found.  This
		// becomes the closest feature.  We then compute a smaller extent which any
		// closer feature must intersect.  We continue searching with this smaller
		// extent, trying to find a closer feature.  Every time we find a closer
		// feature, we update the extent being searched so that any even closer
		// feature must intersect it.  We continue until we run out of features.
		const x = coordinate[0];
		const y = coordinate[1];
		let closestFeature = null as Feature | null;
		const closestPoint = [NaN, NaN];
		let minSquaredDistance = Infinity;
		const extent = [-Infinity, -Infinity, Infinity, Infinity] as Extent;
		const filter = opt_filter ? opt_filter : TRUE;
		this.featuresRtree_!.forEachInExtent(extent,
			/**
			 * @param {module:ol/Feature} feature Feature.
			 */
			(feature) => {
				if (filter(feature)) {
					const geometry = feature.getGeometry();
					const previousMinSquaredDistance = minSquaredDistance;
					minSquaredDistance = geometry.closestPointXY(
						x, y, closestPoint, minSquaredDistance);
					if (minSquaredDistance < previousMinSquaredDistance) {
						closestFeature = feature;
						// This is sneaky.  Reduce the extent that it is currently being
						// searched while the R-Tree traversal using this same extent object
						// is still in progress.  This is safe because the new extent is
						// strictly contained by the old extent.
						const minDistance = Math.sqrt(minSquaredDistance);
						extent[0] = x - minDistance;
						extent[1] = y - minDistance;
						extent[2] = x + minDistance;
						extent[3] = y + minDistance;
					}
				}
			});
		return closestFeature;
	}


	/**
	 * Get the extent of the features currently in the source.
	 *
	 * This method is not available when the source is configured with
	 * `useSpatialIndex` set to `false`.
	 * @param {module:ol/extent~Extent=} opt_extent Destination extent. If provided, no new extent
	 *     will be created. Instead, that extent's coordinates will be overwritten.
	 * @return {module:ol/extent~Extent} Extent.
	 * @api
	 */
	public getExtent(opt_extent?: Extent) {
		return this.featuresRtree_!.getExtent(opt_extent);
	}


	/**
	 * Get a feature by its identifier (the value returned by feature.getId()).
	 * Note that the index treats string and numeric identifiers as the same.  So
	 * `source.getFeatureById(2)` will return a feature with id `'2'` or `2`.
	 *
	 * @param {string|number} id Feature identifier.
	 * @return {module:ol/Feature} The feature (or `null` if not found).
	 * @api
	 */
	public getFeatureById(id: string | number) {
		const feature = this.idIndex_[id.toString()];
		return feature !== undefined ? feature : null;
	}


	/**
	 * Get the format associated with this source.
	 *
	 * @return {module:ol/format/Feature|undefined} The feature format.
	 * @api
	 */
	public getFormat() {
		return this.format_;
	}


	/**
	 * @return {boolean} The source can have overlapping geometries.
	 */
	public getOverlaps() {
		return this.overlaps_;
	}


	/**
	 * @override
	 */
	public getResolutions() { }


	/**
	 * Get the url associated with this source.
	 *
	 * @return {string|module:ol/featureloader~FeatureUrlFunction|undefined} The url.
	 * @api
	 */
	public getUrl() {
		return this.url_;
	}

	/**
	 * Returns true if the feature is contained within the source.
	 * @param {module:ol/Feature} feature Feature.
	 * @return {boolean} Has feature.
	 * @api
	 */
	public hasFeature(feature: Feature) {
		const id = feature.getId();
		if (id !== undefined) {
			return id in this.idIndex_;
		} else {
			const featureKey = getUid(feature).toString();
			return featureKey in this.undefIdIndex_;
		}
	}

	/**
	 * @return {boolean} Is empty.
	 */
	public isEmpty() {
		return this.featuresRtree_!.isEmpty() && isEmpty(this.nullGeometryFeatures_);
	}


	/**
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} resolution Resolution.
	 * @param {module:ol/proj/Projection} projection Projection.
	 */
	public loadFeatures(extent: Extent, resolution: number, projection: Projection) {
		const loadedExtentsRtree = this.loadedExtentsRtree_;
		const extentsToLoad = this.strategy_(extent, resolution);
		for (let i = 0, ii = extentsToLoad.length; i < ii; ++i) {
			const extentToLoad = extentsToLoad[i];
			const alreadyLoaded = loadedExtentsRtree.forEachInExtent(extentToLoad,
				/**
				 * @param {{extent: module:ol/extent~Extent}} object Object.
				 * @return {boolean} Contains.
				 */
				(object) => {
					return containsExtent(object.extent, extentToLoad);
				});
			if (!alreadyLoaded) {
				this.loader_.call(this, extentToLoad, resolution, projection);
				loadedExtentsRtree.insert(extentToLoad, { extent: extentToLoad.slice() as Extent });
			}
		}
	}


	/**
	 * Remove an extent from the list of loaded extents.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @api
	 */
	public removeLoadedExtent(extent: Extent) {
		const loadedExtentsRtree = this.loadedExtentsRtree_;
		let obj;
		loadedExtentsRtree.forEachInExtent(extent, (object) => {
			if (equals(object.extent, extent)) {
				obj = object;
				return true;
			} else {
				return false;
			}
		});
		if (obj) {
			loadedExtentsRtree.remove(obj);
		}
	}

	/**
	 * Remove a single feature from the source.  If you want to remove all features
	 * at once, use the {@link module:ol/source/Vector~VectorSource#clear #clear()} method
	 * instead.
	 * @param {module:ol/Feature} feature Feature to remove.
	 * @api
	 */
	public removeFeature(feature: Feature) {
		const featureKey = getUid(feature).toString();
		if (featureKey in this.nullGeometryFeatures_) {
			delete this.nullGeometryFeatures_[featureKey];
		} else {
			if (this.featuresRtree_) {
				this.featuresRtree_.remove(feature);
			}
		}
		this.removeFeatureInternal(feature);
		this.changed();
	}


	/**
	 * Remove feature without firing a `change` event.
	 * @param {module:ol/Feature} feature Feature.
	 * @protected
	 */
	public removeFeatureInternal(feature: Feature) {
		const featureKey = getUid(feature).toString();
		this.featureChangeKeys_[featureKey].forEach(unlistenByKey);
		delete this.featureChangeKeys_[featureKey];
		const id = feature.getId();
		if (id !== undefined) {
			delete this.idIndex_[id.toString()];
		} else {
			delete this.undefIdIndex_[featureKey];
		}
		this.dispatchEvent(new VectorSourceEvent(
			VectorEventType.REMOVEFEATURE, feature));
	}

	/**
	 * Set the new loader of the source. The next loadFeatures call will use the
	 * new loader.
	 * @param {module:ol/featureloader~FeatureLoader} loader The loader to set.
	 * @api
	 */
	public setLoader(loader: FeatureLoader) {
		this.loader_ = loader;
	}

	/**
	 * Add features without firing a `change` event.
	 * @param {Array.<module:ol/Feature>} features Features.
	 * @protected
	 */
	protected addFeaturesInternal(features: Feature[]) {
		const extents = [];
		const newFeatures = [];
		const geometryFeatures = [];

		for (let i = 0, length = features.length; i < length; i++) {
			const feature = features[i];
			const featureKey = getUid(feature).toString();
			if (this.addToIndex_(featureKey, feature)) {
				newFeatures.push(feature);
			}
		}

		for (let i = 0, length = newFeatures.length; i < length; i++) {
			const feature = newFeatures[i];
			const featureKey = getUid(feature).toString();
			this.setupChangeEvents_(featureKey, feature);

			const geometry = feature.getGeometry();
			if (geometry) {
				const extent = geometry.getExtent();
				extents.push(extent);
				geometryFeatures.push(feature);
			} else {
				this.nullGeometryFeatures_[featureKey] = feature;
			}
		}
		if (this.featuresRtree_) {
			this.featuresRtree_.load(extents, geometryFeatures);
		}

		for (let i = 0, length = newFeatures.length; i < length; i++) {
			this.dispatchEvent(new VectorSourceEvent(VectorEventType.ADDFEATURE, newFeatures[i]));
		}
	}


	/**
	 * @param {!module:ol/Collection.<module:ol/Feature>} collection Collection.
	 * @private
	 */
	private bindFeaturesCollection_(collection: Collection<Feature>) {
		let modifyingCollection = false;
		listen(this, VectorEventType.ADDFEATURE,
			(evt: VectorSourceEvent) => {
				if (!modifyingCollection) {
					modifyingCollection = true;
					collection.push(evt.feature!);
					modifyingCollection = false;
				}
			});
		listen(this, VectorEventType.REMOVEFEATURE,
			(evt: VectorSourceEvent) => {
				if (!modifyingCollection) {
					modifyingCollection = true;
					collection.remove(evt.feature!);
					modifyingCollection = false;
				}
			});
		listen(collection, CollectionEventType.ADD,
			(evt: CollectionEvent) => {
				if (!modifyingCollection) {
					modifyingCollection = true;
					this.addFeature(/** @type {module:ol/Feature} */(evt.element));
					modifyingCollection = false;
				}
			}, this);
		listen(collection, CollectionEventType.REMOVE,
			(evt: CollectionEvent) => {
				if (!modifyingCollection) {
					modifyingCollection = true;
					this.removeFeature(/** @type {module:ol/Feature} */(evt.element));
					modifyingCollection = false;
				}
			}, this);
		this.featuresCollection_ = collection;
	}

	/**
	 * @param {string} featureKey Unique identifier for the feature.
	 * @param {module:ol/Feature} feature The feature.
	 * @private
	 */
	private setupChangeEvents_(featureKey: string, feature: Feature) {
		this.featureChangeKeys_[featureKey] = [
			listen(feature, EventType.CHANGE,
				this.handleFeatureChange_, this)!,
			listen(feature, ObjectEventType.PROPERTYCHANGE,
				this.handleFeatureChange_, this)!
		];
	}


	/**
	 * @param {string} featureKey Unique identifier for the feature.
	 * @param {module:ol/Feature} feature The feature.
	 * @return {boolean} The feature is "valid", in the sense that it is also a
	 *     candidate for insertion into the Rtree.
	 * @private
	 */
	private addToIndex_(featureKey: string, feature: Feature) {
		let valid = true;
		const id = feature.getId();
		if (id !== undefined) {
			if (!(id.toString() in this.idIndex_)) {
				this.idIndex_[id.toString()] = feature;
			} else {
				valid = false;
			}
		} else {
			assert(!(featureKey in this.undefIdIndex_),
				30); // The passed `feature` was already added to the source
			this.undefIdIndex_[featureKey] = feature;
		}
		return valid;
	}

	/**
	 * @param {module:ol/events/Event} event Event.
	 * @private
	 */
	private handleFeatureChange_(event: Event) {
		const feature = /** @type {module:ol/Feature} */ (event.target);
		const featureKey = getUid(feature).toString();
		const geometry = feature.getGeometry();
		if (!geometry) {
			if (!(featureKey in this.nullGeometryFeatures_)) {
				if (this.featuresRtree_) {
					this.featuresRtree_.remove(feature);
				}
				this.nullGeometryFeatures_[featureKey] = feature;
			}
		} else {
			const extent = geometry.getExtent();
			if (featureKey in this.nullGeometryFeatures_) {
				delete this.nullGeometryFeatures_[featureKey];
				if (this.featuresRtree_) {
					this.featuresRtree_.insert(extent, feature);
				}
			} else {
				if (this.featuresRtree_) {
					this.featuresRtree_.update(extent, feature);
				}
			}
		}
		const id = feature.getId();
		if (id !== undefined) {
			const sid = id.toString();
			if (featureKey in this.undefIdIndex_) {
				delete this.undefIdIndex_[featureKey];
				this.idIndex_[sid] = feature;
			} else {
				if (this.idIndex_[sid] !== feature) {
					this.removeFromIdIndex_(feature);
					this.idIndex_[sid] = feature;
				}
			}
		} else {
			if (!(featureKey in this.undefIdIndex_)) {
				this.removeFromIdIndex_(feature);
				this.undefIdIndex_[featureKey] = feature;
			}
		}
		this.changed();
		this.dispatchEvent(new VectorSourceEvent(
			VectorEventType.CHANGEFEATURE, feature));
	}

	/**
	 * Remove a feature from the id index.  Called internally when the feature id
	 * may have changed.
	 * @param {module:ol/Feature} feature The feature.
	 * @return {boolean} Removed the feature from the index.
	 * @private
	 */
	private removeFromIdIndex_(feature: Feature) {
		let removed = false;
		for (const id in this.idIndex_) {
			if (this.idIndex_[id] === feature) {
				delete this.idIndex_[id];
				removed = true;
				break;
			}
		}
		return removed;
	}
}
