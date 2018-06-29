/**
 * @module ol/interaction/PinchZoom
 */
import { Coordinate } from '../coordinate';
import { zoom, zoomWithoutConstraints } from '../interaction/Interaction';
import PointerInteraction, { centroid as centroidFromPointers } from '../interaction/Pointer';
import MapBrowserPointerEvent from '../MapBrowserPointerEvent';
import ViewHint from '../ViewHint';


/**
 * @typedef {Object} Options
 * @property {number} [duration=400] Animation duration in milliseconds.
 * @property {boolean} [constrainResolution=false] Zoom to the closest integer
 * zoom level after the pinch gesture ends.
 */

export interface Options {
	duration: number;
	constrainResolution: boolean;
}

/**
 * @classdesc
 * Allows the user to zoom the map by pinching with two fingers
 * on a touch screen.
 *
 * @constructor
 * @extends {module:ol/interaction/Pointer}
 * @param {module:ol/interaction/PinchZoom~Options=} opt_options Options.
 * @api
 */
export default class PinchZoom extends PointerInteraction {
	private constrainResolution_: boolean;
	private anchor_: Coordinate | null;
	private duration_: number;
	private lastDistance_: number | undefined;
	private lastScaleDelta_: number;
	constructor(opt_options?: Partial<Options>) {
		super({
			handleDownEvent: (e) => {
				return this.hde(e);
			},
			handleDragEvent: (e) => {
				return this.hdge(e);
			},
			handleUpEvent: (e) => {
				return this.hue(e);
			}
		});

		const options = opt_options ? opt_options : {};

		/**
		 * @private
		 * @type {boolean}
		 */
		this.constrainResolution_ = options.constrainResolution || false;

		/**
		 * @private
		 * @type {module:ol/coordinate~Coordinate}
		 */
		this.anchor_ = null;

		/**
		 * @private
		 * @type {number}
		 */
		this.duration_ = options.duration !== undefined ? options.duration : 400;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.lastDistance_ = undefined;

		/**
		 * @private
		 * @type {number}
		 */
		this.lastScaleDelta_ = 1;
	}

	public shouldStopEvent() {
		return false;
	}

	/**
	 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
	 * @this {module:ol/interaction/PinchZoom}
	 */
	private hdge(mapBrowserEvent: MapBrowserPointerEvent) {
		let scaleDelta = 1.0;

		const touch0 = this.targetPointers[0];
		const touch1 = this.targetPointers[1];
		const dx = touch0.clientX! - touch1.clientX!;
		const dy = touch0.clientY! - touch1.clientY!;

		// distance between touches
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (this.lastDistance_ !== undefined) {
			scaleDelta = this.lastDistance_! / distance;
		}
		this.lastDistance_ = distance;


		const map = mapBrowserEvent.map;
		const view = map.getView();
		const resolution = view.getResolution();
		const maxResolution = view.getMaxResolution();
		const minResolution = view.getMinResolution();
		let newResolution = resolution * scaleDelta;
		if (newResolution > maxResolution) {
			scaleDelta = maxResolution / resolution;
			newResolution = maxResolution;
		} else if (newResolution < minResolution) {
			scaleDelta = minResolution / resolution;
			newResolution = minResolution;
		}

		if (scaleDelta !== 1.0) {
			this.lastScaleDelta_ = scaleDelta;
		}

		// scale anchor point.
		const viewportPosition = map.getViewport().getBoundingClientRect();
		const centroid = centroidFromPointers(this.targetPointers);
		centroid[0] -= viewportPosition.left;
		centroid[1] -= viewportPosition.top;
		this.anchor_ = map.getCoordinateFromPixel(centroid);

		// scale, bypass the resolution constraint
		map.render();
		zoomWithoutConstraints(view, newResolution, this.anchor_!);
	}


	/**
	 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
	 * @return {boolean} Stop drag sequence?
	 * @this {module:ol/interaction/PinchZoom}
	 */
	private hue(mapBrowserEvent: MapBrowserPointerEvent) {
		if (this.targetPointers.length < 2) {
			const map = mapBrowserEvent.map;
			const view = map.getView();
			view.setHint(ViewHint.INTERACTING, -1);
			const resolution = view.getResolution();
			if (this.constrainResolution_ ||
				resolution < view.getMinResolution() ||
				resolution > view.getMaxResolution()) {
				// Zoom to final resolution, with an animation, and provide a
				// direction not to zoom out/in if user was pinching in/out.
				// Direction is > 0 if pinching out, and < 0 if pinching in.
				const direction = this.lastScaleDelta_ - 1;
				zoom(view, resolution, this.anchor_!, this.duration_, direction);
			}
			return false;
		} else {
			return true;
		}
	}


	/**
	 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
	 * @return {boolean} Start drag sequence?
	 * @this {module:ol/interaction/PinchZoom}
	 */
	private hde(mapBrowserEvent: MapBrowserPointerEvent) {
		if (this.targetPointers.length >= 2) {
			const map = mapBrowserEvent.map;
			this.anchor_ = null;
			this.lastDistance_ = undefined;
			this.lastScaleDelta_ = 1;
			if (!this.handlingDownUpSequence) {
				map.getView().setHint(ViewHint.INTERACTING, 1);
			}
			return true;
		} else {
			return false;
		}
	}
}
