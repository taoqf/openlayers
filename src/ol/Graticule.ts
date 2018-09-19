/**
 * @module ol/Graticule
 */
import { Coordinate, degreesToStringHDMS } from './coordinate';
import { EventsKey, listen, unlistenByKey } from './events';
import { Extent, getCenter, intersects } from './extent';
import { meridian, parallel } from './geom/flat/geodesic';
import GeometryLayout from './geom/GeometryLayout';
import LineString from './geom/LineString';
import Point from './geom/Point';
import { clamp } from './math';
import PluggableMap from './PluggableMap';
import { equivalent as equivalentProjection, get as getProjection, getTransform, transformExtent, TransformFunction } from './proj';
import Projection from './proj/Projection';
import Event from './render/Event';
import RenderEventType from './render/EventType';
import Fill from './style/Fill';
import Stroke from './style/Stroke';
import Text from './style/Text';


/**
 * @type {module:ol/style/Stroke}
 * @private
 * @const
 */
const DEFAULT_STROKE_STYLE = new Stroke({
	color: 'rgba(0,0,0,0.2)'
});

/**
 * TODO can be configurable
 * @type {Array.<number>}
 * @private
 */
const INTERVALS = [
	90, 45, 30, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.01, 0.005, 0.002, 0.001
];

/**
 * @typedef {Object} GraticuleLabelDataType
 * @property {module:ol/geom/Point} geom
 * @property {string} text
 */
export interface GraticuleLabelDataType {
	geom: Point;
	text: string;
}

/**
 * @typedef {Object} Options
 * @property {module:ol/PluggableMap} [map] Reference to an
 * {@link module:ol/Map~Map} object.
 * @property {number} [maxLines=100] The maximum number of meridians and
 * parallels from the center of the map. The default value of 100 means that at
 * most 200 meridians and 200 parallels will be displayed. The default value is
 * appropriate for conformal projections like Spherical Mercator. If you
 * increase the value, more lines will be drawn and the drawing performance will
 * decrease.
 * @property {module:ol/style/Stroke} [strokeStyle='rgba(0,0,0,0.2)'] The
 * stroke style to use for drawing the graticule. If not provided, a not fully
 * opaque black will be used.
 * @property {number} [targetSize=100] The target size of the graticule cells,
 * in pixels.
 * @property {boolean} [showLabels=false] Render a label with the respective
 * latitude/longitude for each graticule line.
 * @property {function(number):string} [lonLabelFormatter] Label formatter for
 * longitudes. This function is called with the longitude as argument, and
 * should return a formatted string representing the longitude. By default,
 * labels are formatted as degrees, minutes, seconds and hemisphere.
 * @property {function(number):string} [latLabelFormatter] Label formatter for
 * latitudes. This function is called with the latitude as argument, and
 * should return a formatted string representing the latitude. By default,
 * labels are formatted as degrees, minutes, seconds and hemisphere.
 * @property {number} [lonLabelPosition=0] Longitude label position in fractions
 * (0..1) of view extent. 0 means at the bottom of the viewport, 1 means at the
 * top.
 * @property {number} [latLabelPosition=1] Latitude label position in fractions
 * (0..1) of view extent. 0 means at the left of the viewport, 1 means at the
 * right.
 * @property {module:ol/style/Text} [lonLabelStyle] Longitude label text
 * style. If not provided, the following style will be used:
 * ```js
 * new Text({
 *   font: '12px Calibri,sans-serif',
 *   textBaseline: 'bottom',
 *   fill: new Fill({
 *     color: 'rgba(0,0,0,1)'
 *   }),
 *   stroke: new Stroke({
 *     color: 'rgba(255,255,255,1)',
 *     width: 3
 *   })
 * });
 * ```
 * Note that the default's `textBaseline` configuration will not work well for
 * `lonLabelPosition` configurations that position labels close to the top of
 * the viewport.
 * @property {module:ol/style/Text} [latLabelStyle] Latitude label text style.
 * If not provided, the following style will be used:
 * ```js
 * new Text({
 *   font: '12px Calibri,sans-serif',
 *   textAlign: 'end',
 *   fill: new Fill({
 *     color: 'rgba(0,0,0,1)'
 *   }),
 *   stroke: Stroke({
 *     color: 'rgba(255,255,255,1)',
 *     width: 3
 *   })
 * });
 * ```
 * Note that the default's `textAlign` configuration will not work well for
 * `latLabelPosition` configurations that position labels close to the left of
 * the viewport.
 */
export interface Options {
	map: PluggableMap;
	maxLines: number;
	strokeStyle: Stroke;
	targetSize: number;
	showLabels: boolean;
	lonLabelPosition: number;
	latLabelPosition: number;
	lonLabelStyle: Text;
	latLabelStyle: Text;
	lonLabelFormatter(n: number): string;
	latLabelFormatter(n: number): string;
}

/**
 * Render a grid for a coordinate system on a map.
 * @constructor
 * @param {module:ol/Graticule~Options=} opt_options Options.
 * @api
 */
export default class Graticule {
	private map_: PluggableMap | null;
	private postcomposeListenerKey_: EventsKey | null;
	private projection_: Projection | null;
	private maxLat_: number;
	private maxLon_: number;
	private minLat_: number;
	private minLon_: number;
	private maxLatP_: number;
	private maxLonP_: number;
	private minLatP_: number;
	private minLonP_: number;
	private targetSize_: number;
	private maxLines_: number;
	private meridians_: LineString[];
	private parallels_: LineString[];
	private strokeStyle_: Stroke;
	private fromLonLatTransform_: TransformFunction | undefined;
	private toLonLatTransform_: TransformFunction | undefined;
	private projectionCenterLonLat_: Coordinate | null;
	private meridiansLabels_: GraticuleLabelDataType[] | null;
	private parallelsLabels_: GraticuleLabelDataType[] | null;
	private lonLabelFormatter_: null | ((n: number) => string) = null;
	private latLabelFormatter_: null | ((n: number) => string) = null;
	private lonLabelPosition_: number | null = null;
	private latLabelPosition_: number | null = null;
	private lonLabelStyle_: Text | null = null;
	private latLabelStyle_: Text | null = null;
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options || {};

		/**
		 * @type {module:ol/PluggableMap}
		 * @private
		 */
		this.map_ = null;

		/**
		 * @type {?module:ol/events~EventsKey}
		 * @private
		 */
		this.postcomposeListenerKey_ = null;

		/**
		 * @type {module:ol/proj/Projection}
		 */
		this.projection_ = null;

		/**
		 * @type {number}
		 * @private
		 */
		this.maxLat_ = Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.maxLon_ = Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.minLat_ = -Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.minLon_ = -Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.maxLatP_ = Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.maxLonP_ = Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.minLatP_ = -Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.minLonP_ = -Infinity;

		/**
		 * @type {number}
		 * @private
		 */
		this.targetSize_ = options.targetSize !== undefined ? options.targetSize : 100;

		/**
		 * @type {number}
		 * @private
		 */
		this.maxLines_ = options.maxLines !== undefined ? options.maxLines : 100;

		/**
		 * @type {Array.<module:ol/geom/LineString>}
		 * @private
		 */
		this.meridians_ = [];

		/**
		 * @type {Array.<module:ol/geom/LineString>}
		 * @private
		 */
		this.parallels_ = [];

		/**
		 * @type {module:ol/style/Stroke}
		 * @private
		 */
		this.strokeStyle_ = options.strokeStyle !== undefined ? options.strokeStyle : DEFAULT_STROKE_STYLE;

		/**
		 * @type {module:ol/proj~TransformFunction|undefined}
		 * @private
		 */
		this.fromLonLatTransform_ = undefined;

		/**
		 * @type {module:ol/proj~TransformFunction|undefined}
		 * @private
		 */
		this.toLonLatTransform_ = undefined;

		/**
		 * @type {module:ol/coordinate~Coordinate}
		 * @private
		 */
		this.projectionCenterLonLat_ = null;

		/**
		 * @type {Array.<module:ol/Graticule~GraticuleLabelDataType>}
		 * @private
		 */
		this.meridiansLabels_ = null;

		/**
		 * @type {Array.<module:ol/Graticule~GraticuleLabelDataType>}
		 * @private
		 */
		this.parallelsLabels_ = null;

		if (options.showLabels === true) {
			const degreesToString = degreesToStringHDMS;

			/**
			 * @type {null|function(number):string}
			 * @private
			 */
			this.lonLabelFormatter_ = options.lonLabelFormatter === undefined ?
				degreesToString.bind(this, 'EW') : options.lonLabelFormatter;

			/**
			 * @type {function(number):string}
			 * @private
			 */
			this.latLabelFormatter_ = options.latLabelFormatter === undefined ?
				degreesToString.bind(this, 'NS') : options.latLabelFormatter;

			/**
			 * Longitude label position in fractions (0..1) of view extent. 0 means
			 * bottom, 1 means top.
			 * @type {number}
			 * @private
			 */
			this.lonLabelPosition_ = options.lonLabelPosition === undefined ? 0 :
				options.lonLabelPosition;

			/**
			 * Latitude Label position in fractions (0..1) of view extent. 0 means left, 1
			 * means right.
			 * @type {number}
			 * @private
			 */
			this.latLabelPosition_ = options.latLabelPosition === undefined ? 1 :
				options.latLabelPosition;

			/**
			 * @type {module:ol/style/Text}
			 * @private
			 */
			this.lonLabelStyle_ = options.lonLabelStyle !== undefined ? options.lonLabelStyle :
				new Text({
					fill: new Fill({
						color: 'rgba(0,0,0,1)'
					}),
					font: '12px Calibri,sans-serif',
					stroke: new Stroke({
						color: 'rgba(255,255,255,1)',
						width: 3
					}),
					textBaseline: 'bottom'
				});

			/**
			 * @type {module:ol/style/Text}
			 * @private
			 */
			this.latLabelStyle_ = options.latLabelStyle !== undefined ? options.latLabelStyle :
				new Text({
					fill: new Fill({
						color: 'rgba(0,0,0,1)'
					}),
					font: '12px Calibri,sans-serif',
					stroke: new Stroke({
						color: 'rgba(255,255,255,1)',
						width: 3
					}),
					textAlign: 'end'
				});

			this.meridiansLabels_ = [];
			this.parallelsLabels_ = [];
		}

		this.setMap(options.map !== undefined ? options.map : null);
	}

	/**
	 * Get the list of meridians.  Meridians are lines of equal longitude.
	 * @return {Array.<module:ol/geom/LineString>} The meridians.
	 * @api
	 */
	public getMeridians() {
		return this.meridians_;
	}

	/**
	 * Get the map associated with this graticule.
	 * @return {module:ol/PluggableMap} The map.
	 * @api
	 */
	public getMap() {
		return this.map_;
	}


	/**
	 * Get the list of parallels.  Parallels are lines of equal latitude.
	 * @return {Array.<module:ol/geom/LineString>} The parallels.
	 * @api
	 */
	public getParallels() {
		return this.parallels_;
	}

	/**
	 * Set the map for this graticule.  The graticule will be rendered on the
	 * provided map.
	 * @param {module:ol/PluggableMap} map Map.
	 * @api
	 */
	public setMap(map: PluggableMap | null) {
		if (this.map_) {
			unlistenByKey(this.postcomposeListenerKey_);
			this.postcomposeListenerKey_ = null;
			this.map_.render();
		}
		if (map) {
			this.postcomposeListenerKey_ = listen(map, RenderEventType.POSTCOMPOSE, this.handlePostCompose_, this);
			map.render();
		}
		this.map_ = map;
	}

	/**
	 * @param {number} lon Longitude.
	 * @param {number} minLat Minimal latitude.
	 * @param {number} maxLat Maximal latitude.
	 * @param {number} squaredTolerance Squared tolerance.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} index Index.
	 * @return {number} Index.
	 * @private
	 */
	private addMeridian_(lon: number, minLat: number, maxLat: number, squaredTolerance: number, extent: Extent, index: number) {
		const lineString = this.getMeridian_(lon, minLat, maxLat, squaredTolerance, index);
		if (intersects(lineString.getExtent(), extent)) {
			if (this.meridiansLabels_) {
				const textPoint = this.getMeridianPoint_(lineString, extent, index);
				this.meridiansLabels_[index] = {
					geom: textPoint,
					text: this.lonLabelFormatter_(lon)
				};
			}
			this.meridians_[index++] = lineString;
		}
		return index;
	}

	/**
	 * @param {module:ol/geom/LineString} lineString Meridian
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} index Index.
	 * @return {module:ol/geom/Point} Meridian point.
	 * @private
	 */
	private getMeridianPoint_(lineString: LineString, extent: Extent, index: number) {
		const flatCoordinates = lineString.getFlatCoordinates();
		const clampedBottom = Math.max(extent[1], flatCoordinates[1]);
		const clampedTop = Math.min(extent[3], flatCoordinates[flatCoordinates.length - 1]);
		const lat = clamp(
			extent[1] + Math.abs(extent[1] - extent[3]) * this.lonLabelPosition_,
			clampedBottom, clampedTop);
		const coordinate = [flatCoordinates[0], lat] as Coordinate;
		const point = this.meridiansLabels_[index] !== undefined ?
			this.meridiansLabels_[index].geom : new Point(null);
		point.setCoordinates(coordinate);
		return point;
	}

	/**
	 * @param {number} lat Latitude.
	 * @param {number} minLon Minimal longitude.
	 * @param {number} maxLon Maximal longitude.
	 * @param {number} squaredTolerance Squared tolerance.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} index Index.
	 * @return {number} Index.
	 * @private
	 */
	private addParallel_(lat: number, minLon: number, maxLon: number, squaredTolerance: number, extent: Extent, index: number) {
		const lineString = this.getParallel_(lat, minLon, maxLon, squaredTolerance, index);
		if (intersects(lineString.getExtent(), extent)) {
			if (this.parallelsLabels_) {
				const textPoint = this.getParallelPoint_(lineString, extent, index);
				this.parallelsLabels_[index] = {
					geom: textPoint,
					text: this.latLabelFormatter_(lat)
				};
			}
			this.parallels_[index++] = lineString;
		}
		return index;
	}


	/**
	 * @param {module:ol/geom/LineString} lineString Parallels.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} index Index.
	 * @return {module:ol/geom/Point} Parallel point.
	 * @private
	 */
	private getParallelPoint_(lineString: LineString, extent: Extent, index: number) {
		const flatCoordinates = lineString.getFlatCoordinates();
		const clampedLeft = Math.max(extent[0], flatCoordinates[0]);
		const clampedRight = Math.min(extent[2], flatCoordinates[flatCoordinates.length - 2]);
		const lon = clamp(
			extent[0] + Math.abs(extent[0] - extent[2]) * this.latLabelPosition_,
			clampedLeft, clampedRight);
		const coordinate = [lon, flatCoordinates[1]] as Coordinate;
		const point = this.parallelsLabels_[index] !== undefined ?
			this.parallelsLabels_[index].geom : new Point(null);
		point.setCoordinates(coordinate);
		return point;
	}


	/**
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {module:ol/coordinate~Coordinate} center Center.
	 * @param {number} resolution Resolution.
	 * @param {number} squaredTolerance Squared tolerance.
	 * @private
	 */
	private createGraticule_(extent: Extent, center: Coordinate, resolution: number, squaredTolerance: number) {
		const interval = this.getInterval_(resolution);
		if (interval === -1) {
			this.meridians_.length = this.parallels_.length = 0;
			if (this.meridiansLabels_) {
				this.meridiansLabels_.length = 0;
			}
			if (this.parallelsLabels_) {
				this.parallelsLabels_.length = 0;
			}
			return;
		}

		const centerLonLat = this.toLonLatTransform_(center);
		let centerLon = centerLonLat[0];
		let centerLat = centerLonLat[1];
		const maxLines = this.maxLines_;
		let validExtent = [
			Math.max(extent[0], this.minLonP_),
			Math.max(extent[1], this.minLatP_),
			Math.min(extent[2], this.maxLonP_),
			Math.min(extent[3], this.maxLatP_)
		] as Extent;

		validExtent = transformExtent(validExtent, this.projection_, 'EPSG:4326');
		const maxLat = validExtent[3];
		const maxLon = validExtent[2];
		const minLat = validExtent[1];
		const minLon = validExtent[0];

		// Create meridians

		centerLon = Math.floor(centerLon / interval) * interval;
		let lon = clamp(centerLon, this.minLon_, this.maxLon_);

		let idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, 0);

		let cnt = 0;
		while (lon !== this.minLon_ && cnt++ < maxLines) {
			lon = Math.max(lon - interval, this.minLon_);
			idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
		}

		lon = clamp(centerLon, this.minLon_, this.maxLon_);

		cnt = 0;
		while (lon !== this.maxLon_ && cnt++ < maxLines) {
			lon = Math.min(lon + interval, this.maxLon_);
			idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
		}

		this.meridians_.length = idx;
		if (this.meridiansLabels_) {
			this.meridiansLabels_.length = idx;
		}

		// Create parallels

		centerLat = Math.floor(centerLat / interval) * interval;
		let lat = clamp(centerLat, this.minLat_, this.maxLat_);

		idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, 0);

		cnt = 0;
		while (lat !== this.minLat_ && cnt++ < maxLines) {
			lat = Math.max(lat - interval, this.minLat_);
			idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
		}

		lat = clamp(centerLat, this.minLat_, this.maxLat_);

		cnt = 0;
		while (lat !== this.maxLat_ && cnt++ < maxLines) {
			lat = Math.min(lat + interval, this.maxLat_);
			idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
		}

		this.parallels_.length = idx;
		if (this.parallelsLabels_) {
			this.parallelsLabels_.length = idx;
		}
	}

	/**
	 * @param {number} resolution Resolution.
	 * @return {number} The interval in degrees.
	 * @private
	 */
	private getInterval_(resolution: number) {
		const centerLon = this.projectionCenterLonLat_[0];
		const centerLat = this.projectionCenterLonLat_[1];
		let interval = -1;
		const target = Math.pow(this.targetSize_ * resolution, 2);
		const p1 = [] as number[];
		const p2 = [] as number[];
		for (let i = 0, ii = INTERVALS.length; i < ii; ++i) {
			const delta = INTERVALS[i] / 2;
			p1[0] = centerLon - delta;
			p1[1] = centerLat - delta;
			p2[0] = centerLon + delta;
			p2[1] = centerLat + delta;
			this.fromLonLatTransform_(p1, p1);
			this.fromLonLatTransform_(p2, p2);
			const dist = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2);
			if (dist <= target) {
				break;
			}
			interval = INTERVALS[i];
		}
		return interval;
	}

	/**
	 * @param {number} lon Longitude.
	 * @param {number} minLat Minimal latitude.
	 * @param {number} maxLat Maximal latitude.
	 * @param {number} squaredTolerance Squared tolerance.
	 * @param {number} index Index.
	 * @return {module:ol/geom/LineString} The meridian line string.
	 * @private
	 */
	private getMeridian_(lon: number, minLat: number, maxLat: number, squaredTolerance: number, index: number) {
		const flatCoordinates = meridian(lon, minLat, maxLat, this.projection_, squaredTolerance);
		const lineString = this.meridians_[index] !== undefined ? this.meridians_[index] : new LineString(null);
		lineString.setFlatCoordinates(GeometryLayout.XY, flatCoordinates);
		return lineString;
	}

	/**
	 * @param {number} lat Latitude.
	 * @param {number} minLon Minimal longitude.
	 * @param {number} maxLon Maximal longitude.
	 * @param {number} squaredTolerance Squared tolerance.
	 * @return {module:ol/geom/LineString} The parallel line string.
	 * @param {number} index Index.
	 * @private
	 */
	private getParallel_(lat: number, minLon: number, maxLon: number, squaredTolerance: number, index: number) {
		const flatCoordinates = parallel(lat, minLon, maxLon, this.projection_, squaredTolerance);
		const lineString = this.parallels_[index] !== undefined ? this.parallels_[index] : new LineString(null);
		lineString.setFlatCoordinates(GeometryLayout.XY, flatCoordinates);
		return lineString;
	}

	/**
	 * @param {module:ol/render/Event} e Event.
	 * @private
	 */
	private handlePostCompose_(e: Event) {
		const vectorContext = e.vectorContext;
		const frameState = e.frameState;
		const extent = frameState.extent;
		const viewState = frameState.viewState;
		const center = viewState.center;
		const projection = viewState.projection;
		const resolution = viewState.resolution;
		const pixelRatio = frameState.pixelRatio;
		const squaredTolerance =
			resolution * resolution / (4 * pixelRatio * pixelRatio);

		const updateProjectionInfo = !this.projection_ ||
			!equivalentProjection(this.projection_, projection);

		if (updateProjectionInfo) {
			this.updateProjectionInfo_(projection);
		}

		this.createGraticule_(extent, center, resolution, squaredTolerance);

		// Draw the lines
		vectorContext.setFillStrokeStyle(null, this.strokeStyle_);
		for (let i = 0, l = this.meridians_.length; i < l; ++i) {
			const line = this.meridians_[i];
			vectorContext.drawGeometry(line);
		}
		for (let i = 0, l = this.parallels_.length; i < l; ++i) {
			const line = this.parallels_[i];
			vectorContext.drawGeometry(line);
		}
		let labelData;
		if (this.meridiansLabels_) {
			for (let i = 0, l = this.meridiansLabels_.length; i < l; ++i) {
				labelData = this.meridiansLabels_[i];
				this.lonLabelStyle_.setText(labelData.text);
				vectorContext.setTextStyle(this.lonLabelStyle_);
				vectorContext.drawGeometry(labelData.geom);
			}
		}
		if (this.parallelsLabels_) {
			for (let i = 0, l = this.parallelsLabels_.length; i < l; ++i) {
				labelData = this.parallelsLabels_[i];
				this.latLabelStyle_.setText(labelData.text);
				vectorContext.setTextStyle(this.latLabelStyle_);
				vectorContext.drawGeometry(labelData.geom);
			}
		}
	}


	/**
	 * @param {module:ol/proj/Projection} projection Projection.
	 * @private
	 */
	private updateProjectionInfo_(projection: Projection) {
		const epsg4326Projection = getProjection('EPSG:4326');

		const extent = projection.getExtent();
		const worldExtent = projection.getWorldExtent();
		const worldExtentP = transformExtent(worldExtent, epsg4326Projection, projection);

		const maxLat = worldExtent[3];
		const maxLon = worldExtent[2];
		const minLat = worldExtent[1];
		const minLon = worldExtent[0];

		const maxLatP = worldExtentP[3];
		const maxLonP = worldExtentP[2];
		const minLatP = worldExtentP[1];
		const minLonP = worldExtentP[0];

		this.maxLat_ = maxLat;
		this.maxLon_ = maxLon;
		this.minLat_ = minLat;
		this.minLon_ = minLon;

		this.maxLatP_ = maxLatP;
		this.maxLonP_ = maxLonP;
		this.minLatP_ = minLatP;
		this.minLonP_ = minLonP;


		this.fromLonLatTransform_ = getTransform(epsg4326Projection, projection);

		this.toLonLatTransform_ = getTransform(projection, epsg4326Projection);

		this.projectionCenterLonLat_ = this.toLonLatTransform_(getCenter(extent)) as Coordinate;

		this.projection_ = projection;
	}
}
