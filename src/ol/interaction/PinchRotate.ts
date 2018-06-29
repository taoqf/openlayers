/**
 * @module ol/interaction/PinchRotate
 */
import { Coordinate } from '../coordinate';
import { rotate, rotateWithoutConstraints } from '../interaction/Interaction';
import PointerInteraction, { centroid as centroidFromPointers } from '../interaction/Pointer';
import MapBrowserPointerEvent from '../MapBrowserPointerEvent';
import { disable } from '../rotationconstraint';
import ViewHint from '../ViewHint';


/**
 * @typedef {Object} Options
 * @property {number} [duration=250] The duration of the animation in
 * milliseconds.
 * @property {number} [threshold=0.3] Minimal angle in radians to start a rotation.
 */

export interface Options {
	duration: number;
	threshold: number;
}

/**
 * @classdesc
 * Allows the user to rotate the map by twisting with two fingers
 * on a touch screen.
 *
 * @constructor
 * @extends {module:ol/interaction/Pointer}
 * @param {module:ol/interaction/PinchRotate~Options=} opt_options Options.
 * @api
 */
export default class PinchRotate extends PointerInteraction {
	private anchor_: Coordinate | null;
	private lastAngle_: number | undefined;
	private rotating_: boolean;
	private rotationDelta_: number;
	private threshold_: number;
	private duration_: number;
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

		const options = opt_options || {};

		/**
		 * @private
		 * @type {module:ol/coordinate~Coordinate}
		 */
		this.anchor_ = null;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.lastAngle_ = undefined;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.rotating_ = false;

		/**
		 * @private
		 * @type {number}
		 */
		this.rotationDelta_ = 0.0;

		/**
		 * @private
		 * @type {number}
		 */
		this.threshold_ = options.threshold !== undefined ? options.threshold : 0.3;

		/**
		 * @private
		 * @type {number}
		 */
		this.duration_ = options.duration !== undefined ? options.duration : 250;

	}

	public shouldStopEvent() {
		return false;
	}
	/**
	 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
	 * @this {module:ol/interaction/PinchRotate}
	 */
	private hdge(mapBrowserEvent: MapBrowserPointerEvent) {
		let rotationDelta = 0.0;

		const touch0 = this.targetPointers[0];
		const touch1 = this.targetPointers[1];

		// angle between touches
		const angle = Math.atan2(
			touch1.clientY! - touch0.clientY!,
			touch1.clientX! - touch0.clientX!);

		if (this.lastAngle_ !== undefined) {
			const delta = angle - this.lastAngle_;
			this.rotationDelta_ += delta;
			if (!this.rotating_ &&
				Math.abs(this.rotationDelta_) > this.threshold_) {
				this.rotating_ = true;
			}
			rotationDelta = delta;
		}
		this.lastAngle_ = angle;

		const map = mapBrowserEvent.map;
		const view = map.getView();
		if (view.getConstraints().rotation === disable) {
			return;
		}

		// rotate anchor point.
		// FIXME: should be the intersection point between the lines:
		//     touch0,touch1 and previousTouch0,previousTouch1
		const viewportPosition = map.getViewport().getBoundingClientRect();
		const centroid = centroidFromPointers(this.targetPointers);
		centroid[0] -= viewportPosition.left;
		centroid[1] -= viewportPosition.top;
		this.anchor_ = map.getCoordinateFromPixel(centroid);

		// rotate
		if (this.rotating_) {
			const rotation = view.getRotation();
			map.render();
			rotateWithoutConstraints(view, rotation + rotationDelta, this.anchor_!);
		}
	}


	/**
	 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
	 * @return {boolean} Stop drag sequence?
	 * @this {module:ol/interaction/PinchRotate}
	 */
	private hue(mapBrowserEvent: MapBrowserPointerEvent) {
		if (this.targetPointers.length < 2) {
			const map = mapBrowserEvent.map;
			const view = map.getView();
			view.setHint(ViewHint.INTERACTING, -1);
			if (this.rotating_) {
				const rotation = view.getRotation();
				rotate(view, rotation, this.anchor_!, this.duration_);
			}
			return false;
		} else {
			return true;
		}
	}


	/**
	 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
	 * @return {boolean} Start drag sequence?
	 * @this {module:ol/interaction/PinchRotate}
	 */
	private hde(mapBrowserEvent: MapBrowserPointerEvent) {
		if (this.targetPointers.length >= 2) {
			const map = mapBrowserEvent.map;
			this.anchor_ = null;
			this.lastAngle_ = undefined;
			this.rotating_ = false;
			this.rotationDelta_ = 0.0;
			if (!this.handlingDownUpSequence) {
				map.getView().setHint(ViewHint.INTERACTING, 1);
			}
			return true;
		} else {
			return false;
		}
	}
}
