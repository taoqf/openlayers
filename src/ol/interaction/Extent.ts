/**
 * @module ol/interaction/Extent
 */
import { closestOnSegment, Coordinate, distance as coordinateDistance, squaredDistance as squaredCoordinateDistance, squaredDistanceToSegment } from '../coordinate';
import Event from '../events/Event';
import { boundingExtent, Extent, getArea } from '../extent';
import Feature from '../Feature';
import GeometryType from '../geom/GeometryType';
import Point from '../geom/Point';
import { fromExtent as polygonFromExtent } from '../geom/Polygon';
import { Pixel } from '../index';
import PointerInteraction from '../interaction/Pointer';
import VectorLayer from '../layer/Vector';
import MapBrowserEvent from '../MapBrowserEvent';
import MapBrowserEventType from '../MapBrowserEventType';
import MapBrowserPointerEvent from '../MapBrowserPointerEvent';
import PluggableMap from '../PluggableMap';
import RenderFeature from '../render/Feature';
import VectorSource from '../source/Vector';
import Style, { createEditingStyle, StyleFunction } from '../style/Style';

/**
 * @typedef {Object} Options
 * @property {module:ol/extent~Extent} [extent] Initial extent. Defaults to no
 * initial extent.
 * @property {module:ol/style/Style|Array.<module:ol/style/Style>|module:ol/style/Style~StyleFunction} [boxStyle]
 * Style for the drawn extent box. Defaults to
 * {@link module:ol/style/Style~createEditing()['Polygon']}
 * @property {number} [pixelTolerance=10] Pixel tolerance for considering the
 * pointer close enough to a segment or vertex for editing.
 * @property {module:ol/style/Style|Array.<module:ol/style/Style>|module:ol/style/Style~StyleFunction} [pointerStyle]
 * Style for the cursor used to draw the extent. Defaults to
 * {@link module:ol/style/Style~createEditing()['Point']}
 * @property {boolean} [wrapX=false] Wrap the drawn extent across multiple maps
 * in the X direction? Only affects visuals, not functionality.
 */

export interface Options {
	extent: Extent;
	boxStyle: Style | Style[] | StyleFunction;
	pixelTolerance: number;
	pointerStyle: Style | Style[] | StyleFunction;
	wrapX: boolean;
}

/**
 * @enum {string}
 */
enum ExtentEventType {
	/**
	 * Triggered after the extent is changed
	 * @event module:ol/interaction/Extent~ExtentEventType#extentchanged
	 * @api
	 */
	EXTENTCHANGED = 'extentchanged'
}

/**
 * @classdesc
 * Events emitted by {@link module:ol/interaction/Extent~Extent} instances are
 * instances of this type.
 *
 * @constructor
 * @param {module:ol/extent~Extent} extent the new extent
 * @extends {module:ol/events/Event}
 */
class ExtentInteractionEvent extends Event {
	public extent: Extent;
	constructor(extent: Extent) {
		super(ExtentEventType.EXTENTCHANGED);

		/**
		 * The current extent.
		 * @type {module:ol/extent~Extent}
		 * @api
		 */
		this.extent = extent;
	}
}

/**
 * @classdesc
 * Allows the user to draw a vector box by clicking and dragging on the map.
 * Once drawn, the vector box can be modified by dragging its vertices or edges.
 * This interaction is only supported for mouse devices.
 *
 * @constructor
 * @extends {module:ol/interaction/Pointer}
 * @fires module:ol/interaction/Extent~Event
 * @param {module:ol/interaction/Extent~Options=} opt_options Options.
 * @api
 */
export default class ExtentInteraction extends PointerInteraction {
	private extent_: Extent | null;
	private pointerHandler_: ((coordinate: Coordinate) => Extent | null) | null;
	private pixelTolerance_: number;
	private snappedToVertex_: boolean;
	private extentFeature_: Feature | null;
	private vertexFeature_: Feature | null;
	private extentOverlay_: VectorLayer;
	private vertexOverlay_: VectorLayer;
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options || {};

		if (!opt_options) {
			opt_options = {};
		}

		super({
			handleDownEvent: (mapBrowserEvent) => {
				const pixel = mapBrowserEvent.pixel;
				const map = mapBrowserEvent.map;

				const extent = this.getExtent()!;
				let vertex = this.snapToVertex_(pixel, map);

				// find the extent corner opposite the passed corner
				function getOpposingPoint(point: Coordinate) {
					let x_ = null;
					let y_ = null;
					if (point[0] === extent[0]) {
						x_ = extent[2];
					} else if (point[0] === extent[2]) {
						x_ = extent[0];
					}
					if (point[1] === extent[1]) {
						y_ = extent[3];
					} else if (point[1] === extent[3]) {
						y_ = extent[1];
					}
					if (x_ !== null && y_ !== null) {
						return [x_, y_] as Coordinate;
					}
					return null;
				}
				if (vertex && extent) {
					const x = (vertex[0] === extent[0] || vertex[0] === extent[2]) ? vertex[0] : null;
					const y = (vertex[1] === extent[1] || vertex[1] === extent[3]) ? vertex[1] : null;
					// snap to point
					if (x !== null && y !== null) {
						this.pointerHandler_ = getPointHandler(getOpposingPoint(vertex)!);
						// snap to edge
					} else if (x !== null) {
						this.pointerHandler_ = getEdgeHandler(
							getOpposingPoint([x, extent[1]])!,
							getOpposingPoint([x, extent[3]])!
						);
					} else if (y !== null) {
						this.pointerHandler_ = getEdgeHandler(
							getOpposingPoint([extent[0], y])!,
							getOpposingPoint([extent[2], y])!
						);
					}
					// no snap - new bbox
				} else {
					vertex = map.getCoordinateFromPixel(pixel)!;
					this.setExtent([vertex[0], vertex[1], vertex[0], vertex[1]]);
					this.pointerHandler_ = getPointHandler(vertex);
				}
				return true; // event handled; start downup sequence
			},
			handleDragEvent: (mapBrowserEvent) => {
				if (this.pointerHandler_) {
					const pixelCoordinate = mapBrowserEvent.coordinate!;
					this.setExtent(this.pointerHandler_(pixelCoordinate)!);
					this.createOrUpdatePointerFeature_(pixelCoordinate);
				}
				return true;
			},
			handleEvent: (mapBrowserEvent) => {
				return this.handleEvent_(mapBrowserEvent);
			},
			handleUpEvent: (_mapBrowserEvent) => {
				this.pointerHandler_ = null;
				// If bbox is zero area, set to null;
				const extent = this.getExtent();
				if (!extent || getArea(extent) === 0) {
					this.setExtent(null!);
				}
				return false; // Stop handling downup sequence
			}
		});
		/**
		 * Extent of the drawn box
		 * @type {module:ol/extent~Extent}
		 * @private
		 */
		this.extent_ = null;

		/**
		 * Handler for pointer move events
		 * @type {function (module:ol/coordinate~Coordinate): module:ol/extent~Extent|null}
		 * @private
		 */
		this.pointerHandler_ = null;

		/**
		 * Pixel threshold to snap to extent
		 * @type {number}
		 * @private
		 */
		this.pixelTolerance_ = options.pixelTolerance !== undefined ?
			options.pixelTolerance : 10;

		/**
		 * Is the pointer snapped to an extent vertex
		 * @type {boolean}
		 * @private
		 */
		this.snappedToVertex_ = false;

		/**
		 * Feature for displaying the visible extent
		 * @type {module:ol/Feature}
		 * @private
		 */
		this.extentFeature_ = null;

		/**
		 * Feature for displaying the visible pointer
		 * @type {module:ol/Feature}
		 * @private
		 */
		this.vertexFeature_ = null;

		/**
		 * Layer for the extentFeature
		 * @type {module:ol/layer/Vector}
		 * @private
		 */
		this.extentOverlay_ = new VectorLayer({
			source: new VectorSource({
				useSpatialIndex: false,
				wrapX: !!opt_options.wrapX
			}),
			style: opt_options.boxStyle ? opt_options.boxStyle : getDefaultExtentStyleFunction(),
			updateWhileAnimating: true,
			updateWhileInteracting: true
		});

		/**
		 * Layer for the vertexFeature
		 * @type {module:ol/layer/Vector}
		 * @private
		 */
		this.vertexOverlay_ = new VectorLayer({
			source: new VectorSource({
				useSpatialIndex: false,
				wrapX: !!opt_options.wrapX
			}),
			style: opt_options.pointerStyle ? opt_options.pointerStyle : getDefaultPointerStyleFunction(),
			updateWhileAnimating: true,
			updateWhileInteracting: true
		});

		if (opt_options.extent) {
			this.setExtent(opt_options.extent);
		}
	}

	/**
	 * @inheritDoc
	 */
	public setMap(map: PluggableMap) {
		this.extentOverlay_.setMap(map);
		this.vertexOverlay_.setMap(map);
		super.setMap(map);
	}

	/**
	 * Returns the current drawn extent in the view projection
	 *
	 * @return {module:ol/extent~Extent} Drawn extent in the view projection.
	 * @api
	 */
	public getExtent() {
		return this.extent_;
	}

	/**
	 * Manually sets the drawn extent, using the view projection.
	 *
	 * @param {module:ol/extent~Extent} extent Extent
	 * @api
	 */
	public setExtent(extent: Extent) {
		// Null extent means no bbox
		this.extent_ = extent ? extent : null;
		this.createOrUpdateExtentFeature_(extent);
		this.dispatchEvent(new ExtentInteractionEvent(this.extent_!));
	}
	/**
	 * @param {module:ol~Pixel} pixel cursor location
	 * @param {module:ol/PluggableMap} map map
	 * @returns {module:ol/coordinate~Coordinate|null} snapped vertex on extent
	 * @private
	 */
	private snapToVertex_(pixel: Pixel, map: PluggableMap) {
		const pixelCoordinate = map.getCoordinateFromPixel(pixel)!;
		const extent = this.getExtent();
		if (extent) {
			// convert extents to line segments and find the segment closest to pixelCoordinate
			const segments = getSegments(extent);
			segments.sort((a, b) => {
				return squaredDistanceToSegment(pixelCoordinate, a) -
					squaredDistanceToSegment(pixelCoordinate, b);
			});
			const closestSegment = segments[0];

			let vertex = (closestOnSegment(pixelCoordinate, closestSegment));
			const vertexPixel = map.getPixelFromCoordinate(vertex)!;

			// if the distance is within tolerance, snap to the segment
			if (coordinateDistance(pixel, vertexPixel) <= this.pixelTolerance_) {
				// test if we should further snap to a vertex
				const pixel1 = map.getPixelFromCoordinate(closestSegment[0])!;
				const pixel2 = map.getPixelFromCoordinate(closestSegment[1])!;
				const squaredDist1 = squaredCoordinateDistance(vertexPixel, pixel1);
				const squaredDist2 = squaredCoordinateDistance(vertexPixel, pixel2);
				const dist = Math.sqrt(Math.min(squaredDist1, squaredDist2));
				this.snappedToVertex_ = dist <= this.pixelTolerance_;
				if (this.snappedToVertex_) {
					vertex = squaredDist1 > squaredDist2 ?
						closestSegment[1] : closestSegment[0];
				}
				return vertex;
			}
		}
		return null;
	}

	/**
	 * @param {module:ol/MapBrowserEvent} mapBrowserEvent pointer move event
	 * @private
	 */
	private handlePointerMove_(mapBrowserEvent: MapBrowserEvent) {
		const pixel = mapBrowserEvent.pixel;
		const map = mapBrowserEvent.map;

		let vertex = this.snapToVertex_(pixel, map);
		if (!vertex) {
			vertex = map.getCoordinateFromPixel(pixel);
		}
		this.createOrUpdatePointerFeature_(vertex);
	}

	/**
	 * @param {module:ol/extent~Extent} extent extent
	 * @returns {module:ol/Feature} extent as featrue
	 * @private
	 */
	private createOrUpdateExtentFeature_(extent: Extent) {
		let extentFeature = this.extentFeature_;

		if (!extentFeature) {
			if (!extent) {
				extentFeature = new Feature({});
			} else {
				extentFeature = new Feature(polygonFromExtent(extent));
			}
			this.extentFeature_ = extentFeature;
			this.extentOverlay_.getSource().addFeature(extentFeature);
		} else {
			if (!extent) {
				extentFeature.setGeometry(undefined);
			} else {
				extentFeature.setGeometry(polygonFromExtent(extent));
			}
		}
		return extentFeature;
	}


	/**
	 * @param {module:ol/coordinate~Coordinate} vertex location of feature
	 * @returns {module:ol/Feature} vertex as feature
	 * @private
	 */
	private createOrUpdatePointerFeature_(vertex: Coordinate | null) {
		let vertexFeature = this.vertexFeature_;
		if (!vertexFeature) {
			vertexFeature = new Feature(new Point(vertex));
			this.vertexFeature_ = vertexFeature;
			this.vertexOverlay_.getSource().addFeature(vertexFeature);
		} else {
			const geometry = /** @type {module:ol/geom/Point} */ (vertexFeature.getGeometry());
			geometry.setCoordinates(vertex);
		}
		return vertexFeature;
	}

	private handleEvent_(mapBrowserEvent: MapBrowserEvent) {
		if (!(mapBrowserEvent instanceof MapBrowserPointerEvent)) {
			return true;
		}
		// display pointer (if not dragging)
		if (mapBrowserEvent.type === MapBrowserEventType.POINTERMOVE && !this.handlingDownUpSequence) {
			this.handlePointerMove_(mapBrowserEvent);
		}
		// call pointer to determine up/down/drag
		super.handleEvent(mapBrowserEvent);
		// return false to stop propagation
		return false;
	}
}

/**
 * Returns the default style for the drawn bbox
 *
 * @return {module:ol/style/Style~StyleFunction} Default Extent style
 */
function getDefaultExtentStyleFunction() {
	const style = createEditingStyle();
	return ((_feature: Feature | RenderFeature, _resolution: number) => {
		return style[GeometryType.POLYGON];
	}) as StyleFunction;
}

/**
 * Returns the default style for the pointer
 *
 * @return {module:ol/style/Style~StyleFunction} Default pointer style
 */
function getDefaultPointerStyleFunction() {
	const style = createEditingStyle();
	return ((_feature: Feature | RenderFeature, _resolution: number) => {
		return style[GeometryType.POINT];
	}) as StyleFunction;
}

/**
 * @param {module:ol/coordinate~Coordinate} fixedPoint corner that will be unchanged in the new extent
 * @returns {function (module:ol/coordinate~Coordinate): module:ol/extent~Extent} event handler
 */
function getPointHandler(fixedPoint: Coordinate) {
	return (point: Coordinate) => {
		return boundingExtent([fixedPoint, point]);
	};
}

/**
 * @param {module:ol/coordinate~Coordinate} fixedP1 first corner that will be unchanged in the new extent
 * @param {module:ol/coordinate~Coordinate} fixedP2 second corner that will be unchanged in the new extent
 * @returns {function (module:ol/coordinate~Coordinate): module:ol/extent~Extent|null} event handler
 */
function getEdgeHandler(fixedP1: Coordinate, fixedP2: Coordinate) {
	if (fixedP1[0] === fixedP2[0]) {
		return (point: Coordinate) => {
			return boundingExtent([fixedP1, [point[0], fixedP2[1]]]);
		};
	} else if (fixedP1[1] === fixedP2[1]) {
		return (point: Coordinate) => {
			return boundingExtent([fixedP1, [fixedP2[0], point[1]]]);
		};
	} else {
		return null;
	}
}

/**
 * @param {module:ol/extent~Extent} extent extent
 * @returns {Array<Array<module:ol/coordinate~Coordinate>>} extent line segments
 */
function getSegments(extent: Extent) {
	return [
		[[extent[0], extent[1]], [extent[0], extent[3]]],
		[[extent[0], extent[3]], [extent[2], extent[3]]],
		[[extent[2], extent[3]], [extent[2], extent[1]]],
		[[extent[2], extent[1]], [extent[0], extent[1]]]
	] as [[Coordinate, Coordinate], [Coordinate, Coordinate], [Coordinate, Coordinate], [Coordinate, Coordinate]];
}
