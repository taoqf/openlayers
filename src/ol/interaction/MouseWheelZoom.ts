/**
 * @module ol/interaction/MouseWheelZoom
 */
import { Coordinate } from '../coordinate';
import { easeOut } from '../easing';
import { always, Condition } from '../events/condition';
import EventType from '../events/EventType';
import { DEVICE_PIXEL_RATIO, FIREFOX, SAFARI } from '../has';
import Interaction, { zoomByDelta } from '../interaction/Interaction';
import MapBrowserEvent from '../MapBrowserEvent';
import { clamp } from '../math';
import PluggableMap from '../PluggableMap';
import ViewHint from '../ViewHint';


/**
 * Maximum mouse wheel delta.
 * @type {number}
 */
const MAX_DELTA = 1;


/**
 * @enum {string}
 */
enum Mode {
	TRACKPAD = 'trackpad',
	WHEEL = 'wheel'
}


/**
 * @typedef {Object} Options
 * @property {module:ol/events/condition~Condition} [condition] A function that
 * takes an {@link module:ol/MapBrowserEvent~MapBrowserEvent} and returns a
 * boolean to indicate whether that event should be handled. Default is
 * {@link module:ol/events/condition~always}.
 * @property {number} [duration=250] Animation duration in milliseconds.
 * @property {number} [timeout=80] Mouse wheel timeout duration in milliseconds.
 * @property {boolean} [constrainResolution=false] When using a trackpad or
 * magic mouse, zoom to the closest integer zoom level after the scroll gesture
 * ends.
 * @property {boolean} [useAnchor=true] Enable zooming using the mouse's
 * location as the anchor. When set to `false`, zooming in and out will zoom to
 * the center of the screen instead of zooming on the mouse's location.
 */

export interface Options {
	condition: Condition;
	duration: number;
	timeout: number;
	constrainResolution: boolean;
	useAnchor: boolean;
}

/**
 * @classdesc
 * Allows the user to zoom the map by scrolling the mouse wheel.
 *
 * @constructor
 * @extends {module:ol/interaction/Interaction}
 * @param {module:ol/interaction/MouseWheelZoom~Options=} opt_options Options.
 * @api
 */
export default class MouseWheelZoom extends Interaction {
	private delta_: number;
	private duration_: number;
	private timeout_: number;
	private useAnchor_: boolean;
	private constrainResolution_: boolean;
	private condition_: Condition;
	private lastAnchor_: Coordinate | null;
	private startTime_: number | undefined;
	private timeoutId_: number | undefined;
	private mode_: Mode | undefined;
	private trackpadEventGap_: number;
	private trackpadTimeoutId_: number | undefined;
	private trackpadDeltaPerZoom_: number;
	private trackpadZoomBuffer_: number;
	constructor(opt_options?: Partial<Options>) {

		super({
			handleEvent: (e) => {
				return this.he(e);
			}
		});

		const options = opt_options || {};

		/**
		 * @private
		 * @type {number}
		 */
		this.delta_ = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.duration_ = options.duration !== undefined ? options.duration : 250;

		/**
		 * @private
		 * @type {number}
		 */
		this.timeout_ = options.timeout !== undefined ? options.timeout : 80;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.useAnchor_ = options.useAnchor !== undefined ? options.useAnchor : true;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.constrainResolution_ = options.constrainResolution || false;

		/**
		 * @private
		 * @type {module:ol/events/condition~Condition}
		 */
		this.condition_ = options.condition ? options.condition : always;

		/**
		 * @private
		 * @type {?module:ol/coordinate~Coordinate}
		 */
		this.lastAnchor_ = null;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.startTime_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.timeoutId_ = undefined;

		/**
		 * @private
		 * @type {module:ol/interaction/MouseWheelZoom~Mode|undefined}
		 */
		this.mode_ = undefined;

		/**
		 * Trackpad events separated by this delay will be considered separate
		 * interactions.
		 * @type {number}
		 */
		this.trackpadEventGap_ = 400;

		/**
		 * @type {number|undefined}
		 */
		this.trackpadTimeoutId_ = undefined;

		/**
		 * The number of delta values per zoom level
		 * @private
		 * @type {number}
		 */
		this.trackpadDeltaPerZoom_ = 300;

		/**
		 * The zoom factor by which scroll zooming is allowed to exceed the limits.
		 * @private
		 * @type {number}
		 */
		this.trackpadZoomBuffer_ = 1.5;

	}
	/**
	 * Enable or disable using the mouse's location as an anchor when zooming
	 * @param {boolean} useAnchor true to zoom to the mouse's location, false
	 * to zoom to the center of the map
	 * @api
	 */
	public setMouseAnchor(useAnchor: boolean) {
		this.useAnchor_ = useAnchor;
		if (!useAnchor) {
			this.lastAnchor_ = null;
		}
	}
	/**
	 * Handles the {@link module:ol/MapBrowserEvent map browser event} (if it was a
	 * mousewheel-event) and eventually zooms the map.
	 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
	 * @return {boolean} Allow event propagation.
	 * @this {module:ol/interaction/MouseWheelZoom}
	 */
	private he(mapBrowserEvent: MapBrowserEvent) {
		if (!this.condition_(mapBrowserEvent)) {
			return true;
		}
		const type = mapBrowserEvent.type;
		if (type !== EventType.WHEEL && type !== EventType.MOUSEWHEEL) {
			return true;
		}

		mapBrowserEvent.preventDefault();

		const map = mapBrowserEvent.map;
		const wheelEvent = /** @type {WheelEvent} */ (mapBrowserEvent.originalEvent as MouseWheelEvent);

		if (this.useAnchor_) {
			this.lastAnchor_ = mapBrowserEvent.coordinate;
		}

		// Delta normalisation inspired by
		// https://github.com/mapbox/mapbox-gl-js/blob/001c7b9/js/ui/handler/scroll_zoom.js
		let delta = 0;
		if (mapBrowserEvent.type === EventType.WHEEL) {
			delta = wheelEvent.deltaY;
			if (FIREFOX &&
				wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
				delta /= DEVICE_PIXEL_RATIO;
			}
			if (wheelEvent.deltaMode === WheelEvent.DOM_DELTA_LINE) {
				delta *= 40;
			}
		} else if (mapBrowserEvent.type === EventType.MOUSEWHEEL) {
			delta = -wheelEvent.wheelDeltaY;
			if (SAFARI) {
				delta /= 3;
			}
		}

		if (delta === 0) {
			return false;
		}

		const now = Date.now();

		if (this.startTime_ === undefined) {
			this.startTime_ = now;
		}

		if (!this.mode_ || now - this.startTime_ > this.trackpadEventGap_) {
			this.mode_ = Math.abs(delta) < 4 ?
				Mode.TRACKPAD :
				Mode.WHEEL;
		}

		if (this.mode_ === Mode.TRACKPAD) {
			const view = map.getView();
			if (this.trackpadTimeoutId_) {
				clearTimeout(this.trackpadTimeoutId_);
			} else {
				view.setHint(ViewHint.INTERACTING, 1);
			}
			this.trackpadTimeoutId_ = setTimeout(this.decrementInteractingHint_.bind(this), this.trackpadEventGap_);
			let resolution = view.getResolution() * Math.pow(2, delta / this.trackpadDeltaPerZoom_);
			const minResolution = view.getMinResolution();
			const maxResolution = view.getMaxResolution();
			let rebound = 0;
			if (resolution < minResolution) {
				resolution = Math.max(resolution, minResolution / this.trackpadZoomBuffer_);
				rebound = 1;
			} else if (resolution > maxResolution) {
				resolution = Math.min(resolution, maxResolution * this.trackpadZoomBuffer_);
				rebound = -1;
			}
			if (this.lastAnchor_) {
				const center = view.calculateCenterZoom(resolution, this.lastAnchor_)!;
				view.setCenter(view.constrainCenter(center));
			}
			view.setResolution(resolution);

			if (rebound === 0 && this.constrainResolution_) {
				view.animate({
					anchor: this.lastAnchor_!,
					duration: this.duration_,
					easing: easeOut,
					resolution: view.constrainResolution(resolution, delta > 0 ? -1 : 1)
				});
			}

			if (rebound > 0) {
				view.animate({
					anchor: this.lastAnchor_!,
					duration: 500,
					easing: easeOut,
					resolution: minResolution
				});
			} else if (rebound < 0) {
				view.animate({
					anchor: this.lastAnchor_!,
					duration: 500,
					easing: easeOut,
					resolution: maxResolution
				});
			}
			this.startTime_ = now;
			return false;
		}

		this.delta_ += delta;

		const timeLeft = Math.max(this.timeout_ - (now - this.startTime_), 0);

		clearTimeout(this.timeoutId_);
		this.timeoutId_ = setTimeout(this.handleWheelZoom_.bind(this, map), timeLeft);

		return false;
	}

	/**
	 * @private
	 */
	private decrementInteractingHint_() {
		this.trackpadTimeoutId_ = undefined;
		const view = this.getMap()!.getView();
		view.setHint(ViewHint.INTERACTING, -1);
	}


	/**
	 * @private
	 * @param {module:ol/PluggableMap} map Map.
	 */
	private handleWheelZoom_(map: PluggableMap) {
		const view = map.getView();
		if (view.getAnimating()) {
			view.cancelAnimations();
		}
		const maxDelta = MAX_DELTA;
		const delta = clamp(this.delta_, -maxDelta, maxDelta);
		zoomByDelta(view, -delta, this.lastAnchor_!, this.duration_);
		this.mode_ = undefined;
		this.delta_ = 0;
		this.lastAnchor_ = null;
		this.startTime_ = undefined;
		this.timeoutId_ = undefined;
	}
}
