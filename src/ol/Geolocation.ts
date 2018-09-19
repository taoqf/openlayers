/**
 * @module ol/Geolocation
 */
import { Coordinate } from './coordinate';
import { listen } from './events';
import Event from './events/Event';
import EventType from './events/EventType';
import GeolocationProperty from './GeolocationProperty';
import Polygon, { circular as circularPolygon } from './geom/Polygon';
import { GEOLOCATION } from './has';
import { toRadians } from './math';
import BaseObject, { getChangeEventType } from './Object';
import { get as getProjection, getTransformFromProjections, identityTransform, ProjectionLike, TransformFunction } from './proj';
import Projection from './proj/Projection';

/**
 * @typedef {Object} Options
 * @property {boolean} [tracking=false] Start Tracking right after
 * instantiation.
 * @property {GeolocationPositionOptions} [trackingOptions] Tracking options.
 * See {@link http://www.w3.org/TR/geolocation-API/#position_options_interface}.
 * @property {module:ol/proj~ProjectionLike} [projection] The projection the position
 * is reported in.
 */

export interface Options {
	tracking: boolean;
	trackingOptions: GeolocationPositionOptions;
	projection: ProjectionLike;
}

// todo: should rename to PositionOptions
export interface GeolocationPositionOptions {
	enableHighAccuracy: boolean;
	maximumAge: number;
	timeout: number;
}

/**
 * @classdesc
 * Helper class for providing HTML5 Geolocation capabilities.
 * The [Geolocation API](http://www.w3.org/TR/geolocation-API/)
 * is used to locate a user's position.
 *
 * To get notified of position changes, register a listener for the generic
 * `change` event on your instance of {@link module:ol/Geolocation~Geolocation}.
 *
 * Example:
 *
 *     var geolocation = new Geolocation({
 *       // take the projection to use from the map's view
 *       projection: view.getProjection()
 *     });
 *     // listen to changes in position
 *     geolocation.on('change', function(evt) {
 *       window.console.log(geolocation.getPosition());
 *     });
 *
 * @fires error
 * @constructor
 * @extends {module:ol/Object}
 * @param {module:ol/Geolocation~Options=} opt_options Options.
 * @api
 */
export default class Geolocation extends BaseObject {
	private position_: Coordinate | null;
	private transform_: TransformFunction;
	private watchId_: number | undefined;
	constructor(opt_options?: Partial<Options>) {

		super();

		const options = opt_options || {};

		/**
		 * The unprojected (EPSG:4326) device position.
		 * @private
		 * @type {module:ol/coordinate~Coordinate}
		 */
		this.position_ = null;

		/**
		 * @private
		 * @type {module:ol/proj~TransformFunction}
		 */
		this.transform_ = identityTransform;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.watchId_ = undefined;

		listen(
			this, getChangeEventType(GeolocationProperty.PROJECTION),
			this.handleProjectionChanged_, this);
		listen(
			this, getChangeEventType(GeolocationProperty.TRACKING),
			this.handleTrackingChanged_, this);

		if (options.projection !== undefined) {
			this.setProjection(options.projection);
		}
		if (options.trackingOptions !== undefined) {
			this.setTrackingOptions(options.trackingOptions);
		}

		this.setTracking(options.tracking !== undefined ? options.tracking : false);
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		this.setTracking(false);
		super.disposeInternal();
	}


	/**
	 * Get the accuracy of the position in meters.
	 * @return {number|undefined} The accuracy of the position measurement in
	 *     meters.
	 * @observable
	 * @api
	 */
	public getAccuracy() {
		return (this.get(GeolocationProperty.ACCURACY)) as number | undefined;
	}


	/**
	 * Get a geometry of the position accuracy.
	 * @return {?module:ol/geom/Polygon} A geometry of the position accuracy.
	 * @observable
	 * @api
	 */
	public getAccuracyGeometry() {
		return (this.get(GeolocationProperty.ACCURACY_GEOMETRY) || null) as Polygon;
	}


	/**
	 * Get the altitude associated with the position.
	 * @return {number|undefined} The altitude of the position in meters above mean
	 *     sea level.
	 * @observable
	 * @api
	 */
	public getAltitude() {
		return this.get(GeolocationProperty.ALTITUDE) as number | undefined;
	}


	/**
	 * Get the altitude accuracy of the position.
	 * @return {number|undefined} The accuracy of the altitude measurement in
	 *     meters.
	 * @observable
	 * @api
	 */
	public getAltitudeAccuracy() {
		return this.get(GeolocationProperty.ALTITUDE_ACCURACY) as number | undefined;
	}


	/**
	 * Get the heading as radians clockwise from North.
	 * Note: depending on the browser, the heading is only defined if the `enableHighAccuracy`
	 * is set to `true` in the tracking options.
	 * @return {number|undefined} The heading of the device in radians from north.
	 * @observable
	 * @api
	 */
	public getHeading() {
		return this.get(GeolocationProperty.HEADING) as number | undefined;
	}

	/**
	 * Get the position of the device.
	 * @return {module:ol/coordinate~Coordinate|undefined} The current position of the device reported
	 *     in the current projection.
	 * @observable
	 * @api
	 */
	public getPosition() {
		return this.get(GeolocationProperty.POSITION) as Coordinate | undefined;
	}

	/**
	 * Get the projection associated with the position.
	 * @return {module:ol/proj/Projection|undefined} The projection the position is
	 *     reported in.
	 * @observable
	 * @api
	 */
	public getProjection() {
		return this.get(GeolocationProperty.PROJECTION) as Projection | undefined;
	}

	/**
	 * Get the speed in meters per second.
	 * @return {number|undefined} The instantaneous speed of the device in meters
	 *     per second.
	 * @observable
	 * @api
	 */
	public getSpeed() {
		return this.get(GeolocationProperty.SPEED) as number | undefined;
	}

	/**
	 * Determine if the device location is being tracked.
	 * @return {boolean} The device location is being tracked.
	 * @observable
	 * @api
	 */
	public getTracking() {
		return this.get(GeolocationProperty.TRACKING) as boolean;
	}


	/**
	 * Get the tracking options.
	 * @see http://www.w3.org/TR/geolocation-API/#position-options
	 * @return {GeolocationPositionOptions|undefined} PositionOptions as defined by
	 *     the [HTML5 Geolocation spec
	 *     ](http://www.w3.org/TR/geolocation-API/#position_options_interface).
	 * @observable
	 * @api
	 */
	public getTrackingOptions() {
		return this.get(GeolocationProperty.TRACKING_OPTIONS) as GeolocationPositionOptions;
	}


	/**
	 * Set the projection to use for transforming the coordinates.
	 * @param {module:ol/proj~ProjectionLike} projection The projection the position is
	 *     reported in.
	 * @observable
	 * @api
	 */
	public setProjection(projection: ProjectionLike) {
		this.set(GeolocationProperty.PROJECTION, getProjection(projection));
	}


	/**
	 * Enable or disable tracking.
	 * @param {boolean} tracking Enable tracking.
	 * @observable
	 * @api
	 */
	public setTracking(tracking: boolean) {
		this.set(GeolocationProperty.TRACKING, tracking);
	}

	/**
	 * Set the tracking options.
	 * @see http://www.w3.org/TR/geolocation-API/#position-options
	 * @param {GeolocationPositionOptions} options PositionOptions as defined by the
	 *     [HTML5 Geolocation spec
	 *     ](http://www.w3.org/TR/geolocation-API/#position_options_interface).
	 * @observable
	 * @api
	 */
	public setTrackingOptions(options: GeolocationPositionOptions) {
		this.set(GeolocationProperty.TRACKING_OPTIONS, options);
	}

	/**
	 * @private
	 */
	private handleProjectionChanged_() {
		const projection = this.getProjection();
		if (projection) {
			this.transform_ = getTransformFromProjections(
				getProjection('EPSG:4326'), projection);
			if (this.position_) {
				this.set(GeolocationProperty.POSITION, this.transform_(this.position_));
			}
		}
	}


	/**
	 * @private
	 */
	private handleTrackingChanged_() {
		if (GEOLOCATION) {
			const tracking = this.getTracking();
			if (tracking && this.watchId_ === undefined) {
				this.watchId_ = navigator.geolocation.watchPosition(
					this.positionChange_.bind(this),
					this.positionError_.bind(this),
					this.getTrackingOptions());
			} else if (!tracking && this.watchId_ !== undefined) {
				navigator.geolocation.clearWatch(this.watchId_);
				this.watchId_ = undefined;
			}
		}
	}

	/**
	 * @private
	 * @param {GeolocationPosition} position position event.
	 */
	private positionChange_(position: Position) {
		const coords = position.coords;
		this.set(GeolocationProperty.ACCURACY, coords.accuracy);
		this.set(GeolocationProperty.ALTITUDE,
			coords.altitude === null ? undefined : coords.altitude);
		this.set(GeolocationProperty.ALTITUDE_ACCURACY,
			coords.altitudeAccuracy === null ?
				undefined : coords.altitudeAccuracy);
		this.set(GeolocationProperty.HEADING, coords.heading === null ?
			undefined : toRadians(coords.heading));
		if (!this.position_) {
			this.position_ = [coords.longitude, coords.latitude];
		} else {
			this.position_[0] = coords.longitude;
			this.position_[1] = coords.latitude;
		}
		const projectedPosition = this.transform_(this.position_);
		this.set(GeolocationProperty.POSITION, projectedPosition);
		this.set(GeolocationProperty.SPEED,
			coords.speed === null ? undefined : coords.speed);
		const geometry = circularPolygon(this.position_, coords.accuracy);
		geometry.applyTransform(this.transform_);
		this.set(GeolocationProperty.ACCURACY_GEOMETRY, geometry);
		this.changed();
	}

	/**
	 * Triggered when the Geolocation returns an error.
	 * @event error
	 * @api
	 */

	/**
	 * @private
	 * @param {GeolocationPositionError} error error object.
	 */
	private positionError_(error: PositionError) {
		(error as any as Event).type = EventType.ERROR;
		this.setTracking(false);
		this.dispatchEvent(/** @type {{type: string, target: undefined}} */((error as any as Event)));
	}
}
