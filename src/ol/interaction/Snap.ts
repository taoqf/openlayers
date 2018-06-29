/**
 * @module ol/interaction/Snap
 */
import Collection, { CollectionEvent } from '../Collection';
import CollectionEventType from '../CollectionEventType';
import { closestOnCircle, closestOnSegment, Coordinate, distance as coordinateDistance, squaredDistance as squaredCoordinateDistance, squaredDistanceToSegment } from '../coordinate';
import { EventsKey, listen, unlistenByKey } from '../events';
import Event from '../events/Event';
import EventType from '../events/EventType';
import { boundingExtent, createEmpty, Extent } from '../extent';
import Feature from '../Feature';
import Circle from '../geom/Circle';
import Geometry from '../geom/Geometry';
import GeometryCollection from '../geom/GeometryCollection';
import GeometryType from '../geom/GeometryType';
import LineString from '../geom/LineString';
import MultiLineString from '../geom/MultiLineString';
import MultiPoint from '../geom/MultiPoint';
import MultiPolygon from '../geom/MultiPolygon';
import Point from '../geom/Point';
import Polygon, { fromCircle } from '../geom/Polygon';
import { getUid, Pixel } from '../index';
import PointerInteraction from '../interaction/Pointer';
import { getValues } from '../obj';
import PluggableMap from '../PluggableMap';
import VectorSource, { VectorSourceEvent } from '../source/Vector';
import VectorEventType from '../source/VectorEventType';
import RBush from '../structs/RBush';


/**
 * @typedef {Object} Result
 * @property {boolean} snapped
 * @property {module:ol/coordinate~Coordinate|null} vertex
 * @property {module:ol~Pixel|null} vertexPixel
 */

export interface Result {
	snapped: boolean;
	vertex: Coordinate | null;
	vertexPixel: Pixel | null;
}

/**
 * @typedef {Object} SegmentData
 * @property {module:ol/Feature} feature
 * @property {Array.<module:ol/coordinate~Coordinate>} segment
 */

export interface SegmentData {
	feature: Feature;
	segment: Coordinate[];
}

/**
 * @typedef {Object} Options
 * @property {module:ol/Collection.<module:ol/Feature>} [features] Snap to these features. Either this option or source should be provided.
 * @property {boolean} [edge=true] Snap to edges.
 * @property {boolean} [vertex=true] Snap to vertices.
 * @property {number} [pixelTolerance=10] Pixel tolerance for considering the pointer close enough to a segment or
 * vertex for snapping.
 * @property {module:ol/source/Vector} [source] Snap to features from this source. Either this option or features should be provided
 */

export interface Options {
	features: Collection<Feature>;
	edge: boolean;
	vertex: boolean;
	pixelTolerance: number;
	source: VectorSource;
}

/**
 * @classdesc
 * Handles snapping of vector features while modifying or drawing them.  The
 * features can come from a {@link module:ol/source/Vector} or {@link module:ol/Collection~Collection}
 * Any interaction object that allows the user to interact
 * with the features using the mouse can benefit from the snapping, as long
 * as it is added before.
 *
 * The snap interaction modifies map browser event `coordinate` and `pixel`
 * properties to force the snap to occur to any interaction that them.
 *
 * Example:
 *
 *     import Snap from 'ol/interaction/Snap';
 *
 *     var snap = new Snap({
 *       source: source
 *     });
 *
 * @constructor
 * @extends {module:ol/interaction/Pointer}
 * @param {module:ol/interaction/Snap~Options=} opt_options Options.
 * @api
 */
export default class Snap extends PointerInteraction {
	private source_: VectorSource | null;
	private vertex_: boolean;
	private edge_: boolean;
	private features_: Collection<Feature> | null;
	private featuresListenerKeys_: EventsKey[];
	private featureChangeListenerKeys_: { [e: number]: EventsKey; };
	private indexedFeaturesExtents_: { [n: number]: Extent; };
	private pendingFeatures_: { [id: number]: Feature; };
	private pixelCoordinate_: Coordinate | null;
	private pixelTolerance_: number;
	private rBush_: RBush<SegmentData>;
	private SEGMENT_WRITERS_: { [type: string]: (feature: Feature, geometry: Geometry) => void; };
	constructor(opt_options: Partial<Options>) {
		super({
			handleEvent: (evt) => {
				const result = this.snapTo(evt.pixel, evt.coordinate!, evt.map);
				if (result.snapped) {
					evt.coordinate = result.vertex!.slice(0, 2) as Coordinate;
					evt.pixel = result.vertexPixel!;
				}
				return this.handleEvent(evt);
			},
			handleDownEvent(_e) {
				return true;
			},
			/**
			 * @param {module:ol/MapBrowserPointerEvent} evt Event.
			 * @return {boolean} Stop drag sequence?
			 * @this {module:ol/interaction/Snap}
			 */
			handleUpEvent: (_e) => {
				const featuresToUpdate = getValues(this.pendingFeatures_);
				if (featuresToUpdate.length) {
					featuresToUpdate.forEach(this.updateFeature_.bind(this));
					this.pendingFeatures_ = {};
				}
				return false;
			}
		});

		const options = opt_options ? opt_options : {};

		/**
		 * @type {module:ol/source/Vector}
		 * @private
		 */
		this.source_ = options.source ? options.source : null;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.vertex_ = options.vertex !== undefined ? options.vertex : true;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.edge_ = options.edge !== undefined ? options.edge : true;

		/**
		 * @type {module:ol/Collection.<module:ol/Feature>}
		 * @private
		 */
		this.features_ = options.features ? options.features : null;

		/**
		 * @type {Array.<module:ol/events~EventsKey>}
		 * @private
		 */
		this.featuresListenerKeys_ = [];

		/**
		 * @type {Object.<number, module:ol/events~EventsKey>}
		 * @private
		 */
		this.featureChangeListenerKeys_ = {};

		/**
		 * Extents are preserved so indexed segment can be quickly removed
		 * when its feature geometry changes
		 * @type {Object.<number, module:ol/extent~Extent>}
		 * @private
		 */
		this.indexedFeaturesExtents_ = {};

		/**
		 * If a feature geometry changes while a pointer drag|move event occurs, the
		 * feature doesn't get updated right away.  It will be at the next 'pointerup'
		 * event fired.
		 * @type {!Object.<number, module:ol/Feature>}
		 * @private
		 */
		this.pendingFeatures_ = {};

		/**
		 * Used for distance sorting in sortByDistance_
		 * @type {module:ol/coordinate~Coordinate}
		 * @private
		 */
		this.pixelCoordinate_ = null;

		/**
		 * @type {number}
		 * @private
		 */
		this.pixelTolerance_ = options.pixelTolerance !== undefined ?
			options.pixelTolerance : 10;

		/**
		 * Segment RTree for each layer
		 * @type {module:ol/structs/RBush.<module:ol/interaction/Snap~SegmentData>}
		 * @private
		 */
		this.rBush_ = new RBush<SegmentData>();


		/**
		 * @const
		 * @private
		 * @type {Object.<string, function(module:ol/Feature, module:ol/geom/Geometry)>}
		 */
		this.SEGMENT_WRITERS_ = {
			Circle: this.writeCircleGeometry_,
			GeometryCollection: this.writeGeometryCollectionGeometry_,
			LineString: this.writeLineStringGeometry_,
			LinearRing: this.writeLineStringGeometry_,
			MultiLineString: this.writeMultiLineStringGeometry_,
			MultiPoint: this.writeMultiPointGeometry_,
			MultiPolygon: this.writeMultiPolygonGeometry_,
			Point: this.writePointGeometry_,
			Polygon: this.writePolygonGeometry_
		} as any;
	}

	/**
	 * Add a feature to the collection of features that we may snap to.
	 * @param {module:ol/Feature} feature Feature.
	 * @param {boolean=} opt_listen Whether to listen to the feature change or not
	 *     Defaults to `true`.
	 * @api
	 */
	public addFeature(feature: Feature, opt_listen?: boolean) {
		const register = opt_listen !== undefined ? opt_listen : true;
		const feature_uid = getUid(feature);
		const geometry = feature.getGeometry();
		if (geometry) {
			const segmentWriter = this.SEGMENT_WRITERS_[geometry.getType()];
			if (segmentWriter) {
				this.indexedFeaturesExtents_[feature_uid] = geometry.getExtent(createEmpty());
				segmentWriter.call(this, feature, geometry);
			}
		}

		if (register) {
			this.featureChangeListenerKeys_[feature_uid] = listen(
				feature,
				EventType.CHANGE,
				this.handleFeatureChange_, this)!;
		}
	}

	/**
	 * Remove a feature from the collection of features that we may snap to.
	 * @param {module:ol/Feature} feature Feature
	 * @param {boolean=} opt_unlisten Whether to unlisten to the feature change
	 *     or not. Defaults to `true`.
	 * @api
	 */
	public removeFeature(feature: Feature, opt_unlisten?: boolean) {
		const unregister = opt_unlisten !== undefined ? opt_unlisten : true;
		const feature_uid = getUid(feature);
		const extent = this.indexedFeaturesExtents_[feature_uid];
		if (extent) {
			const rBush = this.rBush_;
			const nodesToRemove: SegmentData[] = [];
			rBush.forEachInExtent(extent, (node) => {
				if (feature === node.feature) {
					nodesToRemove.push(node);
				}
			});
			nodesToRemove.forEach((node) => {
				rBush.remove(node);
			});
		}

		if (unregister) {
			unlistenByKey(this.featureChangeListenerKeys_[feature_uid]);
			delete this.featureChangeListenerKeys_[feature_uid];
		}
	}


	/**
	 * @inheritDoc
	 */
	public setMap(map: PluggableMap) {
		const currentMap = this.getMap();
		const keys = this.featuresListenerKeys_;
		const features = this.getFeatures_() as Feature[];

		if (currentMap) {
			keys.forEach(unlistenByKey);
			keys.length = 0;
			features.forEach((feature: Feature) => {
				this.forEachFeatureRemove_(feature);
			});
		}
		PointerInteraction.prototype.setMap.call(this, map);

		if (map) {
			if (this.features_) {
				keys.push(
					listen(this.features_, CollectionEventType.ADD,
						this.handleFeatureAdd_, this)!,
					listen(this.features_, CollectionEventType.REMOVE,
						this.handleFeatureRemove_, this)!
				);
			} else if (this.source_) {
				keys.push(
					listen(this.source_, VectorEventType.ADDFEATURE,
						this.handleFeatureAdd_, this)!,
					listen(this.source_, VectorEventType.REMOVEFEATURE,
						this.handleFeatureRemove_, this)!
				);
			}
			features.forEach(this.forEachFeatureAdd_.bind(this));
		}
	}


	/**
	 * @inheritDoc
	 */
	public shouldStopEvent() {
		return false;
	}


	/**
	 * @param {module:ol~Pixel} pixel Pixel
	 * @param {module:ol/coordinate~Coordinate} pixelCoordinate Coordinate
	 * @param {module:ol/PluggableMap} map Map.
	 * @return {module:ol/interaction/Snap~Result} Snap result
	 */
	public snapTo(pixel: Pixel, pixelCoordinate: Coordinate, map: PluggableMap) {
		const lowerLeft = map.getCoordinateFromPixel(
			[pixel[0] - this.pixelTolerance_, pixel[1] + this.pixelTolerance_])!;
		const upperRight = map.getCoordinateFromPixel(
			[pixel[0] + this.pixelTolerance_, pixel[1] - this.pixelTolerance_])!;
		const box = boundingExtent([lowerLeft, upperRight]);

		let segments = this.rBush_.getInExtent(box);

		// If snapping on vertices only, don't consider circles
		if (this.vertex_ && !this.edge_) {
			segments = segments.filter((segment) => {
				return segment.feature.getGeometry().getType() !==
					GeometryType.CIRCLE;
			});
		}

		let snappedToVertex = false;
		let snapped = false;
		let vertex = null;
		let vertexPixel = null;
		let dist;
		let pixel1;
		let pixel2;
		let squaredDist1;
		let squaredDist2;
		if (segments.length > 0) {
			this.pixelCoordinate_ = pixelCoordinate;
			segments.sort((a, b) => {
				const pixel_coordinate = this.pixelCoordinate_!;
				const deltaA = squaredDistanceToSegment(pixel_coordinate, a.segment as [Coordinate, Coordinate]);
				const deltaB = squaredDistanceToSegment(pixel_coordinate, b.segment as [Coordinate, Coordinate]);
				return deltaA - deltaB;
			});
			const closestSegment = segments[0].segment as [Coordinate, Coordinate];
			const isCircle = segments[0].feature.getGeometry().getType() ===
				GeometryType.CIRCLE;
			if (this.vertex_ && !this.edge_) {
				pixel1 = map.getPixelFromCoordinate(closestSegment[0])!;
				pixel2 = map.getPixelFromCoordinate(closestSegment[1])!;
				squaredDist1 = squaredCoordinateDistance(pixel, pixel1);
				squaredDist2 = squaredCoordinateDistance(pixel, pixel2);
				dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
				snappedToVertex = dist <= this.pixelTolerance_;
				if (snappedToVertex) {
					snapped = true;
					vertex = squaredDist1 > squaredDist2 ? closestSegment[1] : closestSegment[0];
					vertexPixel = map.getPixelFromCoordinate(vertex);
				}
			} else if (this.edge_) {
				if (isCircle) {
					vertex = closestOnCircle(pixelCoordinate,
					/** @type {module:ol/geom/Circle} */(segments[0].feature.getGeometry()));
				} else {
					vertex = closestOnSegment(pixelCoordinate, closestSegment);
				}
				vertexPixel = map.getPixelFromCoordinate(vertex)!;
				if (coordinateDistance(pixel, vertexPixel) <= this.pixelTolerance_) {
					snapped = true;
					if (this.vertex_ && !isCircle) {
						pixel1 = map.getPixelFromCoordinate(closestSegment[0])!;
						pixel2 = map.getPixelFromCoordinate(closestSegment[1])!;
						squaredDist1 = squaredCoordinateDistance(vertexPixel, pixel1);
						squaredDist2 = squaredCoordinateDistance(vertexPixel, pixel2);
						dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
						snappedToVertex = dist <= this.pixelTolerance_;
						if (snappedToVertex) {
							vertex = squaredDist1 > squaredDist2 ? closestSegment[1] : closestSegment[0];
							vertexPixel = map.getPixelFromCoordinate(vertex);
						}
					}
				}
			}
			if (snapped) {
				vertexPixel = [Math.round(vertexPixel![0]), Math.round(vertexPixel![1])] as Pixel;
			}
		}
		return (
				/** @type {module:ol/interaction/Snap~Result} */ ({
				snapped,
				vertex,
				vertexPixel
			})
		);
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @private
	 */
	private updateFeature_(feature: Feature) {
		this.removeFeature(feature, false);
		this.addFeature(feature, false);
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/Circle} geometry Geometry.
	 * @private
	 */
	private writeCircleGeometry_(feature: Feature, geometry: Circle) {
		const polygon = fromCircle(geometry);
		const coordinates = polygon.getCoordinates()[0];
		for (let i = 0, ii = coordinates.length - 1; i < ii; ++i) {
			const segment = coordinates.slice(i, i + 2);
			const segmentData = /** @type {module:ol/interaction/Snap~SegmentData} */ ({
				feature,
				segment
			});
			this.rBush_.insert(boundingExtent(segment), segmentData);
		}
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/GeometryCollection} geometry Geometry.
	 * @private
	 */
	private writeGeometryCollectionGeometry_(feature: Feature, geometry: GeometryCollection) {
		const geometries = geometry.getGeometriesArray()!;
		geometries.forEach((geo) => {
			const segmentWriter = this.SEGMENT_WRITERS_[geo.getType()];
			if (segmentWriter) {
				segmentWriter.call(this, feature, geo);
			}
		});
	}

	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/LineString} geometry Geometry.
	 * @private
	 */
	private writeLineStringGeometry_(feature: Feature, geometry: LineString) {
		const coordinates = geometry.getCoordinates();
		for (let i = 0, ii = coordinates.length - 1; i < ii; ++i) {
			const segment = coordinates.slice(i, i + 2);
			const segmentData = /** @type {module:ol/interaction/Snap~SegmentData} */ ({
				feature,
				segment
			});
			this.rBush_.insert(boundingExtent(segment), segmentData);
		}
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/MultiLineString} geometry Geometry.
	 * @private
	 */
	private writeMultiLineStringGeometry_(feature: Feature, geometry: MultiLineString) {
		const lines = geometry.getCoordinates();
		for (let j = 0, jj = lines.length; j < jj; ++j) {
			const coordinates = lines[j];
			for (let i = 0, ii = coordinates.length - 1; i < ii; ++i) {
				const segment = coordinates.slice(i, i + 2);
				const segmentData = /** @type {module:ol/interaction/Snap~SegmentData} */ ({
					feature,
					segment
				});
				this.rBush_.insert(boundingExtent(segment), segmentData);
			}
		}
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/MultiPoint} geometry Geometry.
	 * @private
	 */
	private writeMultiPointGeometry_(feature: Feature, geometry: MultiPoint) {
		const points = geometry.getCoordinates();
		for (let i = 0, ii = points.length; i < ii; ++i) {
			const coordinates = points[i];
			const segmentData = /** @type {module:ol/interaction/Snap~SegmentData} */ ({
				feature,
				segment: [coordinates, coordinates]
			});
			this.rBush_.insert(geometry.getExtent(), segmentData);
		}
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/MultiPolygon} geometry Geometry.
	 * @private
	 */
	private writeMultiPolygonGeometry_(feature: Feature, geometry: MultiPolygon) {
		const polygons = geometry.getCoordinates();
		for (let k = 0, kk = polygons.length; k < kk; ++k) {
			const rings = polygons[k];
			for (let j = 0, jj = rings.length; j < jj; ++j) {
				const coordinates = rings[j];
				for (let i = 0, ii = coordinates.length - 1; i < ii; ++i) {
					const segment = coordinates.slice(i, i + 2);
					const segmentData = /** @type {module:ol/interaction/Snap~SegmentData} */ ({
						feature,
						segment
					});
					this.rBush_.insert(boundingExtent(segment), segmentData);
				}
			}
		}
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/Point} geometry Geometry.
	 * @private
	 */
	private writePointGeometry_(feature: Feature, geometry: Point) {
		const coordinates = geometry.getCoordinates();
		const segmentData = /** @type {module:ol/interaction/Snap~SegmentData} */ ({
			feature,
			segment: [coordinates, coordinates]
		});
		this.rBush_.insert(geometry.getExtent(), segmentData);
	}


	/**
	 * @param {module:ol/Feature} feature Feature
	 * @param {module:ol/geom/Polygon} geometry Geometry.
	 * @private
	 */
	private writePolygonGeometry_(feature: Feature, geometry: Polygon) {
		const rings = geometry.getCoordinates();
		for (let j = 0, jj = rings.length; j < jj; ++j) {
			const coordinates = rings[j];
			for (let i = 0, ii = coordinates.length - 1; i < ii; ++i) {
				const segment = coordinates.slice(i, i + 2);
				const segmentData = /** @type {module:ol/interaction/Snap~SegmentData} */ ({
					feature,
					segment
				});
				this.rBush_.insert(boundingExtent(segment), segmentData);
			}
		}
	}

	/**
	 * @param {module:ol/Feature} feature Feature.
	 * @private
	 */
	private forEachFeatureAdd_(feature: Feature) {
		this.addFeature(feature);
	}


	/**
	 * @param {module:ol/Feature} feature Feature.
	 * @private
	 */
	private forEachFeatureRemove_(feature: Feature) {
		this.removeFeature(feature);
	}


	/**
	 * @return {module:ol/Collection.<module:ol/Feature>|Array.<module:ol/Feature>} Features.
	 * @private
	 */
	private getFeatures_() {
		let features;
		if (this.features_) {
			features = this.features_;
		} else if (this.source_) {
			features = this.source_.getFeatures();
		}
		return (
				/** @type {!Array.<module:ol/Feature>|!module:ol/Collection.<module:ol/Feature>} */ (features)
		);
	}


	/**
	 * @param {module:ol/source/Vector|module:ol/Collection~CollectionEvent} evt Event.
	 * @private
	 */
	private handleFeatureAdd_(evt: VectorSource | CollectionEvent) {
		let feature;
		if (evt instanceof VectorSourceEvent) {
			feature = evt.feature;
		} else if (evt instanceof CollectionEvent) {
			feature = evt.element;
		}
		this.addFeature(/** @type {module:ol/Feature} */(feature));
	}


	/**
	 * @param {module:ol/source/Vector|module:ol/Collection~CollectionEvent} evt Event.
	 * @private
	 */
	private handleFeatureRemove_(evt: VectorSource | CollectionEvent) {
		let feature;
		if (evt instanceof VectorSourceEvent) {
			feature = evt.feature;
		} else if (evt instanceof CollectionEvent) {
			feature = evt.element;
		}
		this.removeFeature(/** @type {module:ol/Feature} */(feature as Feature));
	}


	/**
	 * @param {module:ol/events/Event} evt Event.
	 * @private
	 */
	private handleFeatureChange_(evt: Event) {
		const feature = /** @type {module:ol/Feature} */ (evt.target);
		if (this.handlingDownUpSequence) {
			const uid = getUid(feature);
			if (!(uid in this.pendingFeatures_)) {
				this.pendingFeatures_[uid] = feature;
			}
		} else {
			this.updateFeature_(feature);
		}
	}

}
