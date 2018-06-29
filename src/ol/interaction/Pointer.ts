/**
 * @module ol/interaction/Pointer
 */
import Interaction from '../interaction/Interaction';
import MapBrowserEvent from '../MapBrowserEvent';
import MapBrowserEventType from '../MapBrowserEventType';
import MapBrowserPointerEvent from '../MapBrowserPointerEvent';
import { getValues } from '../obj';
import PointerEvent from '../pointer/PointerEvent';
import { Pixel } from '../index';

/**
 * @typedef {Object} Options
 * @property {(function(module:ol/MapBrowserPointerEvent):boolean)} [handleDownEvent]
 * Function handling "down" events. If the function returns `true` then a drag
 * sequence is started.
 * @property {(function(module:ol/MapBrowserPointerEvent))} [handleDragEvent]
 * Function handling "drag" events. This function is called on "move" events
 * during a drag sequence.
 * @property {(function(module:ol/MapBrowserEvent):boolean)} [handleEvent]
 * Method called by the map to notify the interaction that a browser event was
 * dispatched to the map. The function may return `false` to prevent the
 * propagation of the event to other interactions in the map's interactions
 * chain.
 * @property {(function(module:ol/MapBrowserPointerEvent))} [handleMoveEvent]
 * Function handling "move" events. This function is called on "move" events,
 * also during a drag sequence (so during a drag sequence both the
 * `handleDragEvent` function and this function are called).
 * @property {(function(module:ol/MapBrowserPointerEvent):boolean)} [handleUpEvent]
 *  Function handling "up" events. If the function returns `false` then the
 * current drag sequence is stopped.
 */

export interface Options {
	handleDownEvent(e: MapBrowserPointerEvent): boolean;
	handleDragEvent(e: MapBrowserPointerEvent): void;
	handleEvent(e: MapBrowserEvent): boolean;
	handleMoveEvent(e: MapBrowserPointerEvent): boolean;
	handleUpEvent(e: MapBrowserPointerEvent): boolean;
}

/**
 * @param {Array.<module:ol/pointer/PointerEvent>} pointerEvents List of events.
 * @return {module:ol~Pixel} Centroid pixel.
 */
export function centroid(pointerEvents: PointerEvent[]) {
	const [clientX, clientY] = pointerEvents.reduce(([x, y], pointerEvent) => {
		return [x + pointerEvent.clientX!, y + pointerEvent.clientY!];
	}, [0, 0]);
	const length = pointerEvents.length;
	return [clientX / length, clientY / length] as Pixel;
}

/**
 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Whether the event is a pointerdown, pointerdrag
 *     or pointerup event.
 */
function isPointerDraggingEvent(mapBrowserEvent: MapBrowserPointerEvent) {
	const type = mapBrowserEvent.type;
	return type === MapBrowserEventType.POINTERDOWN ||
		type === MapBrowserEventType.POINTERDRAG ||
		type === MapBrowserEventType.POINTERUP;
}

/**
 * @classdesc
 * Base class that calls user-defined functions on `down`, `move` and `up`
 * events. This class also manages "drag sequences".
 *
 * When the `handleDownEvent` user function returns `true` a drag sequence is
 * started. During a drag sequence the `handleDragEvent` user function is
 * called on `move` events. The drag sequence ends when the `handleUpEvent`
 * user function is called and returns `false`.
 *
 * @constructor
 * @param {module:ol/interaction/Pointer~Options=} opt_options Options.
 * @extends {module:ol/interaction/Interaction}
 * @api
 */
export default class PointerInteraction extends Interaction {
	protected handlingDownUpSequence: boolean;
	protected targetPointers: PointerEvent[];
	private trackedPointers_: { [s: string]: PointerEvent };
	private handleDragEvent_: (e: MapBrowserPointerEvent) => void;
	private handleUpEvent_: (e: MapBrowserPointerEvent) => boolean;
	private handleDownEvent_: (e: MapBrowserPointerEvent) => boolean;
	private handleMoveEvent_: (e: MapBrowserPointerEvent) => void;

	constructor(opt_options?: Partial<Options>) {
		super({
			handleEvent: (opt_options && opt_options.handleEvent) || ((e: MapBrowserEvent) => {
				return this.handleEvent(e);
			})
		});
		const options = opt_options ? opt_options : {};

		/**
		 * @type {function(module:ol/MapBrowserPointerEvent):boolean}
		 * @private
		 */
		this.handleDownEvent_ = options.handleDownEvent ?
			options.handleDownEvent : handleDownEvent;

		/**
		 * @type {function(module:ol/MapBrowserPointerEvent)}
		 * @private
		 */
		this.handleDragEvent_ = options.handleDragEvent ?
			options.handleDragEvent : handleDragEvent;

		/**
		 * @type {function(module:ol/MapBrowserPointerEvent)}
		 * @private
		 */
		this.handleMoveEvent_ = options.handleMoveEvent ?
			options.handleMoveEvent : handleMoveEvent;

		/**
		 * @type {function(module:ol/MapBrowserPointerEvent):boolean}
		 * @private
		 */
		this.handleUpEvent_ = options.handleUpEvent ?
			options.handleUpEvent : handleUpEvent;

		/**
		 * @type {boolean}
		 * @protected
		 */
		this.handlingDownUpSequence = false;

		/**
		 * @type {!Object.<string, module:ol/pointer/PointerEvent>}
		 * @private
		 */
		this.trackedPointers_ = {};

		/**
		 * @type {Array.<module:ol/pointer/PointerEvent>}
		 * @protected
		 */
		this.targetPointers = [];
	}

	/**
	 * Handles the {@link module:ol/MapBrowserEvent map browser event} and may call into
	 * other functions, if event sequences like e.g. 'drag' or 'down-up' etc. are
	 * detected.
	 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
	 * @return {boolean} `false` to stop event propagation.
	 * @this {module:ol/interaction/Pointer}
	 * @api
	 */
	public handleEvent = (mapBrowserEvent: MapBrowserEvent) => {
		if (!(mapBrowserEvent instanceof MapBrowserPointerEvent)) {
			return true;
		}

		let stopEvent = false;
		this.updateTrackedPointers_(mapBrowserEvent);
		if (this.handlingDownUpSequence) {
			if (mapBrowserEvent.type === MapBrowserEventType.POINTERDRAG) {
				this.handleDragEvent_(mapBrowserEvent);
			} else if (mapBrowserEvent.type === MapBrowserEventType.POINTERUP) {
				const handledUp = this.handleUpEvent_(mapBrowserEvent);
				this.handlingDownUpSequence = handledUp && this.targetPointers.length > 0;
			}
		} else {
			if (mapBrowserEvent.type === MapBrowserEventType.POINTERDOWN) {
				const handled = this.handleDownEvent_(mapBrowserEvent);
				this.handlingDownUpSequence = handled;
				stopEvent = this.shouldStopEvent(handled);
			} else if (mapBrowserEvent.type === MapBrowserEventType.POINTERMOVE) {
				this.handleMoveEvent_(mapBrowserEvent);
			}
		}
		return !stopEvent;
	}
	/**
	 * This method is used to determine if "down" events should be propagated to
	 * other interactions or should be stopped.
	 *
	 * The method receives the return code of the "handleDownEvent" function.
	 *
	 * By default this function is the "identity" function. It's overridden in
	 * child classes.
	 *
	 * @param {boolean} handled Was the event handled by the interaction?
	 * @return {boolean} Should the event be stopped?
	 * @protected
	 */
	protected shouldStopEvent(handled: boolean) {
		return handled;
	}

	/**
	 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
	 * @private
	 */
	private updateTrackedPointers_(mapBrowserEvent: MapBrowserPointerEvent) {
		if (isPointerDraggingEvent(mapBrowserEvent)) {
			const event = mapBrowserEvent.pointerEvent;

			const id = event.pointerId!.toString();
			if (mapBrowserEvent.type === MapBrowserEventType.POINTERUP) {
				delete this.trackedPointers_[id];
			} else if (mapBrowserEvent.type ===
				MapBrowserEventType.POINTERDOWN) {
				this.trackedPointers_[id] = event;
			} else if (id in this.trackedPointers_) {
				// update only when there was a pointerdown event for this pointer
				this.trackedPointers_[id] = event;
			}
			this.targetPointers = getValues(this.trackedPointers_);
		}
	}
}

/**
 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
 * @this {module:ol/interaction/Pointer}
 */
function handleDragEvent(_e: MapBrowserPointerEvent) {
}

/**
 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Capture dragging.
 * @this {module:ol/interaction/Pointer}
 */
function handleUpEvent(_e: MapBrowserPointerEvent) {
	return false;
}

/**
 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
 * @return {boolean} Capture dragging.
 * @this {module:ol/interaction/Pointer}
 */
function handleDownEvent(_e: MapBrowserPointerEvent) {
	return false;
}

/**
 * @param {module:ol/MapBrowserPointerEvent} mapBrowserEvent Event.
 * @this {module:ol/interaction/Pointer}
 */
function handleMoveEvent(_e: MapBrowserPointerEvent) {
	return undefined;
}
