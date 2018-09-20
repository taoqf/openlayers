/**
 * @module ol/source/Cluster
 */

import { assert } from '../asserts';
import { add as addCoordinate, Coordinate, scale as scaleCoordinate } from '../coordinate';
import { listen } from '../events';
import EventType from '../events/EventType';
import { buffer, createEmpty, createOrUpdateFromCoordinate, Extent } from '../extent';
import Feature from '../Feature';
import Point from '../geom/Point';
import { getUid } from '../index';
import Projection from '../proj/Projection';
import RenderFeature from '../render/Feature';
import VectorSource from '../source/Vector';
import { AttributionLike } from './Source';
// import { ProjectionLike } from '../proj';

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {number} [distance=20] Minimum distance in pixels between clusters.
 * @property {module:ol/extent~Extent} [extent] Extent.
 * @property {function(module:ol/Feature):module:ol/geom/Point} [geometryFunction]
 * Function that takes an {@link module:ol/Feature} as argument and returns an
 * {@link module:ol/geom/Point} as cluster calculation point for the feature. When a
 * feature should not be considered for clustering, the function should return
 * `null`. The default, which works when the underyling source contains point
 * features only, is
 * ```js
 * function(feature) {
 *   return feature.getGeometry();
 * }
 * ```
 * See {@link module:ol/geom/Polygon~Polygon#getInteriorPoint} for a way to get a cluster
 * calculation point for polygons.
 * @property {module:ol/proj~ProjectionLike} projection Projection.
 * @property {module:ol/source/Vector} source Source.
 * @property {boolean} [wrapX=true] Whether to wrap the world horizontally.
 */
export interface Options {
	attributions: AttributionLike;
	distance: number;
	// extent: Extent;
	// projection: ProjectionLike;
	source: VectorSource;
	wrapX?: boolean;
	geometryFunction(feature: Feature | RenderFeature): Point;
}

/**
 * @classdesc
 * Layer source to cluster vector data. Works out of the box with point
 * geometries. For other geometry types, or if not all geometries should be
 * considered for clustering, a custom `geometryFunction` can be defined.
 *
 * @constructor
 * @param {module:ol/source/Cluster~Options=} options Cluster options.
 * @extends {module:ol/source/Vector}
 * @api
 */
export default class Cluster extends VectorSource {
	public geometryFunction: (feature: Feature | RenderFeature) => Point;
	protected resolution: number | undefined;
	protected distance: number;
	protected features: Feature[];
	protected source: VectorSource;
	constructor(options: Options) {
		super({
			attributions: options.attributions,
			// extent: options.extent,	// todo extent and projection is not needed here
			// projection: options.projection,
			wrapX: options.wrapX
		});

		/**
		 * @type {number|undefined}
		 * @protected
		 */
		this.resolution = undefined;

		/**
		 * @type {number}
		 * @protected
		 */
		this.distance = options.distance !== undefined ? options.distance : 20;

		/**
		 * @type {Array.<module:ol/Feature>}
		 * @protected
		 */
		this.features = [];

		/**
		 * @param {module:ol/Feature} feature Feature.
		 * @return {module:ol/geom/Point} Cluster calculation point.
		 * @protected
		 */
		this.geometryFunction = options.geometryFunction || ((feature: Feature) => {
			const geometry = feature.getGeometry() as Point;
			assert(geometry instanceof Point,
				10); // The default `geometryFunction` can only handle `module:ol/geom/Point~Point` geometries
			return geometry;
		});

		/**
		 * @type {module:ol/source/Vector}
		 * @protected
		 */
		this.source = options.source;

		listen(this.source, EventType.CHANGE, this.refresh, this);
	}

	/**
	 * Get the distance in pixels between clusters.
	 * @return {number} Distance.
	 * @api
	 */
	public getDistance() {
		return this.distance;
	}


	/**
	 * Get a reference to the wrapped source.
	 * @return {module:ol/source/Vector} Source.
	 * @api
	 */
	public getSource() {
		return this.source;
	}


	public loadFeatures(extent: Extent, resolution: number, projection: Projection) {
		this.source.loadFeatures(extent, resolution, projection);
		if (resolution !== this.resolution) {
			this.clear();
			this.resolution = resolution;
			this.cluster();
			this.addFeatures(this.features);
		}
	}


	/**
	 * Set the distance in pixels between clusters.
	 * @param {number} distance The distance in pixels.
	 * @api
	 */
	public setDistance(distance: number) {
		this.distance = distance;
		this.refresh();
	}


	/**
	 * handle the source changing
	 * @override
	 */
	public refresh() {
		this.clear();
		this.cluster();
		this.addFeatures(this.features);
		super.refresh();
	}


	/**
	 * @protected
	 */
	protected cluster() {
		if (this.resolution === undefined) {
			return;
		}
		this.features.length = 0;
		const extent = createEmpty();
		const mapDistance = this.distance * this.resolution;
		const features = this.source.getFeatures();

		/**
		 * @type {!Object.<string, boolean>}
		 */
		const clustered = {} as { [uid: string]: boolean; };

		for (let i = 0, ii = features.length; i < ii; i++) {
			const feature = features[i];
			if (!(getUid(feature).toString() in clustered)) {
				const geometry = this.geometryFunction(feature);
				if (geometry) {
					const coordinates = geometry.getCoordinates();
					createOrUpdateFromCoordinate(coordinates, extent);
					buffer(extent, mapDistance, extent);

					let neighbors = this.source.getFeaturesInExtent(extent);
					neighbors = neighbors.filter((neighbor) => {
						const uid = getUid(neighbor).toString();
						if (!(uid in clustered)) {
							clustered[uid] = true;
							return true;
						} else {
							return false;
						}
					});
					this.features.push(this.createCluster(neighbors));
				}
			}
		}
	}


	/**
	 * @param {Array.<module:ol/Feature>} features Features
	 * @return {module:ol/Feature} The cluster feature.
	 * @protected
	 */
	protected createCluster(features: Feature[]) {
		const centroid = [0, 0] as Coordinate;
		for (let i = features.length - 1; i >= 0; --i) {
			const geometry = this.geometryFunction(features[i]);
			if (geometry) {
				addCoordinate(centroid, geometry.getCoordinates());
			} else {
				features.splice(i, 1);
			}
		}
		scaleCoordinate(centroid, 1 / features.length);

		const cluster = new Feature(new Point(centroid));
		cluster.set('features', features);
		return cluster;
	}
}
