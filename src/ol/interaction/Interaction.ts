/**
 * @module ol/interaction/Interaction
 */
import { Coordinate } from '../coordinate';
import { easeOut, linear } from '../easing';
import InteractionProperty from '../interaction/Property';
import MapBrowserEvent from '../MapBrowserEvent';
import { clamp } from '../math';
import BaseObject from '../Object';
import PluggableMap from '../PluggableMap';
import View, { AnimationOptions } from '../View';


/**
 * Object literal with config options for interactions.
 * @typedef {Object} InteractionOptions
 * @property {function(module:ol/MapBrowserEvent):boolean} handleEvent
 * Method called by the map to notify the interaction that a browser event was
 * dispatched to the map. If the function returns a falsy value, propagation of
 * the event to other interactions in the map's interactions chain will be
 * prevented (this includes functions with no explicit return).
 */

export interface InteractionOptions {
	handleEvent(e: MapBrowserEvent): boolean;
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * User actions that change the state of the map. Some are similar to controls,
 * but are not associated with a DOM element.
 * For example, {@link module:ol/interaction/KeyboardZoom~KeyboardZoom} is
 * functionally the same as {@link module:ol/control/Zoom~Zoom}, but triggered
 * by a keyboard event not a button element event.
 * Although interactions do not have a DOM element, some of them do render
 * vectors and so are visible on the screen.
 *
 * @constructor
 * @param {module:ol/interaction/Interaction~InteractionOptions} options Options.
 * @extends {module:ol/Object}
 * @api
 */
export default class Interaction extends BaseObject {
	public handleEvent: ((e: MapBrowserEvent) => boolean) | undefined;
	private map_: PluggableMap | null;
	constructor(options: Partial<InteractionOptions>) {
		super();

		/**
		 * @private
		 * @type {module:ol/PluggableMap}
		 */
		this.map_ = null;

		this.setActive(true);

		/**
		 * @type {function(module:ol/MapBrowserEvent):boolean}
		 */
		this.handleEvent = options.handleEvent;
	}

	/**
	 * Return whether the interaction is currently active.
	 * @return {boolean} `true` if the interaction is active, `false` otherwise.
	 * @observable
	 * @api
	 */
	public getActive() {
		return /** @type {boolean} */ (this.get(InteractionProperty.ACTIVE));
	}


	/**
	 * Get the map associated with this interaction.
	 * @return {module:ol/PluggableMap} Map.
	 * @api
	 */
	public getMap() {
		return this.map_;
	}


	/**
	 * Activate or deactivate the interaction.
	 * @param {boolean} active Active.
	 * @observable
	 * @api
	 */
	public setActive(active: boolean) {
		this.set(InteractionProperty.ACTIVE, active);
	}


	/**
	 * Remove the interaction from its current map and attach it to the new map.
	 * Subclasses may set up event handlers to get notified about changes to
	 * the map here.
	 * @param {module:ol/PluggableMap} map Map.
	 */
	public setMap(map: PluggableMap) {
		this.map_ = map;
	}
}

/**
 * @param {module:ol/View} view View.
 * @param {module:ol/coordinate~Coordinate} delta Delta.
 * @param {number=} opt_duration Duration.
 */
export function pan(view: View, delta: Coordinate, opt_duration?: number) {
	const currentCenter = view.getCenter();
	if (currentCenter) {
		const center = view.constrainCenter(
			[currentCenter[0] + delta[0], currentCenter[1] + delta[1]]);
		if (opt_duration) {
			view.animate({
				center,
				duration: opt_duration,
				easing: linear
			} as AnimationOptions);
		} else {
			view.setCenter(center);
		}
	}
}


/**
 * @param {module:ol/View} view View.
 * @param {number|undefined} rotation Rotation.
 * @param {module:ol/coordinate~Coordinate=} opt_anchor Anchor coordinate.
 * @param {number=} opt_duration Duration.
 */
export function rotate(view: View, rotation: number | undefined, opt_anchor?: Coordinate, opt_duration?: number) {
	rotation = view.constrainRotation(rotation, 0);
	rotateWithoutConstraints(view, rotation, opt_anchor, opt_duration);
}


/**
 * @param {module:ol/View} view View.
 * @param {number|undefined} rotation Rotation.
 * @param {module:ol/coordinate~Coordinate=} opt_anchor Anchor coordinate.
 * @param {number=} opt_duration Duration.
 */
export function rotateWithoutConstraints(view: View, rotation: number | undefined, opt_anchor?: Coordinate, opt_duration?: number) {
	if (rotation !== undefined) {
		const currentRotation = view.getRotation();
		const currentCenter = view.getCenter();
		if (currentRotation !== undefined && currentCenter && opt_duration! > 0) {
			view.animate({
				anchor: opt_anchor,
				duration: opt_duration,
				easing: easeOut,
				rotation
			} as AnimationOptions);
		} else {
			view.rotate(rotation, opt_anchor);
		}
	}
}


/**
 * @param {module:ol/View} view View.
 * @param {number|undefined} resolution Resolution to go to.
 * @param {module:ol/coordinate~Coordinate=} opt_anchor Anchor coordinate.
 * @param {number=} opt_duration Duration.
 * @param {number=} opt_direction Zooming direction; > 0 indicates
 *     zooming out, in which case the constraints system will select
 *     the largest nearest resolution; < 0 indicates zooming in, in
 *     which case the constraints system will select the smallest
 *     nearest resolution; == 0 indicates that the zooming direction
 *     is unknown/not relevant, in which case the constraints system
 *     will select the nearest resolution. If not defined 0 is
 *     assumed.
 */
export function zoom(view: View, resolution: number | undefined, opt_anchor?: Coordinate, opt_duration?: number, opt_direction?: number) {
	resolution = view.constrainResolution(resolution, 0, opt_direction)!;
	zoomWithoutConstraints(view, resolution, opt_anchor, opt_duration);
}


/**
 * @param {module:ol/View} view View.
 * @param {number} delta Delta from previous zoom level.
 * @param {module:ol/coordinate~Coordinate=} opt_anchor Anchor coordinate.
 * @param {number=} opt_duration Duration.
 */
export function zoomByDelta(view: View, delta: number, opt_anchor?: Coordinate, opt_duration?: number) {
	const currentResolution = view.getResolution();
	let resolution = view.constrainResolution(currentResolution, delta, 0)!;

	if (resolution !== undefined) {
		const resolutions = view.getResolutions();
		resolution = clamp(
			resolution,
			view.getMinResolution() || resolutions[resolutions.length - 1],
			view.getMaxResolution() || resolutions[0]);
	}

	// If we have a constraint on center, we need to change the anchor so that the
	// new center is within the extent. We first calculate the new center, apply
	// the constraint to it, and then calculate back the anchor
	if (opt_anchor && resolution !== undefined && resolution !== currentResolution) {
		const currentCenter = view.getCenter();
		let center = view.calculateCenterZoom(resolution, opt_anchor)!;
		center = view.constrainCenter(center)!;

		opt_anchor = [
			(resolution * currentCenter[0] - currentResolution * center[0]) /
			(resolution - currentResolution),
			(resolution * currentCenter[1] - currentResolution * center[1]) /
			(resolution - currentResolution)
		];
	}

	zoomWithoutConstraints(view, resolution, opt_anchor, opt_duration);
}


/**
 * @param {module:ol/View} view View.
 * @param {number|undefined} resolution Resolution to go to.
 * @param {module:ol/coordinate~Coordinate=} opt_anchor Anchor coordinate.
 * @param {number=} opt_duration Duration.
 */
export function zoomWithoutConstraints(view: View, resolution: number, opt_anchor?: Coordinate, opt_duration?: number) {
	if (resolution) {
		const currentResolution = view.getResolution();
		const currentCenter = view.getCenter();
		if (currentResolution !== undefined && currentCenter &&
			resolution !== currentResolution && opt_duration) {
			view.animate({
				anchor: opt_anchor,
				duration: opt_duration,
				easing: easeOut,
				resolution
			} as AnimationOptions);
		} else {
			if (opt_anchor) {
				const center = view.calculateCenterZoom(resolution, opt_anchor);
				view.setCenter(center);
			}
			view.setResolution(resolution);
		}
	}
}
