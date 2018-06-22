/**
 * @module ol/MapBrowserEventHandler
 */
import { EventsKey, listen, unlistenByKey } from './events';
import EventTarget from './events/EventTarget';
import { DEVICE_PIXEL_RATIO } from './has';
import MapBrowserEventType from './MapBrowserEventType';
import MapBrowserPointerEvent from './MapBrowserPointerEvent';
import PluggableMap from './PluggableMap';
import PointerEventType from './pointer/EventType';
import PointerEvent from './pointer/PointerEvent';
import PointerEventHandler from './pointer/PointerEventHandler';

/**
 * @param {module:ol/PluggableMap} map The map with the viewport to
 * listen to events on.
 * @param {number=} moveTolerance The minimal distance the pointer must travel
 * to trigger a move.
 * @constructor
 * @extends {module:ol/events/EventTarget}
 */
export default class MapBrowserEventHandler extends EventTarget {
	private map_: PluggableMap;
	private clickTimeoutId_: number;
	private dragging_: boolean;
	private dragListenerKeys_: EventsKey[];
	private moveTolerance_: number;
	private down_: PointerEvent | null;
	private activePointers_: number;
	private trackedTouches_: { [key: number]: boolean; };
	private pointerEventHandler_: PointerEventHandler | null;
	private documentPointerEventHandler_: PointerEventHandler | null;
	private pointerdownListenerKey_: EventsKey | undefined | null;
	private relayedListenerKey_: EventsKey | undefined | null;
	constructor(map: PluggableMap, moveTolerance: number) {
		super();
		/**
		 * This is the element that we will listen to the real events on.
		 * @type {module:ol/PluggableMap}
		 * @private
		 */
		this.map_ = map;

		/**
		 * @type {number}
		 * @private
		 */
		this.clickTimeoutId_ = 0;

		/**
		 * @type {boolean}
		 * @private
		 */
		this.dragging_ = false;

		/**
		 * @type {!Array.<module:ol/events~EventsKey>}
		 * @private
		 */
		this.dragListenerKeys_ = [];

		/**
		 * @type {number}
		 * @private
		 */
		this.moveTolerance_ = moveTolerance ?
			moveTolerance * DEVICE_PIXEL_RATIO : DEVICE_PIXEL_RATIO;

		/**
		 * The most recent "down" type event (or null if none have occurred).
		 * Set on pointerdown.
		 * @type {module:ol/pointer/PointerEvent}
		 * @private
		 */
		this.down_ = null;

		const element = this.map_.getViewport();

		/**
		 * @type {number}
		 * @private
		 */
		this.activePointers_ = 0;

		/**
		 * @type {!Object.<number, boolean>}
		 * @private
		 */
		this.trackedTouches_ = {};

		/**
		 * Event handler which generates pointer events for
		 * the viewport element.
		 *
		 * @type {module:ol/pointer/PointerEventHandler}
		 * @private
		 */
		this.pointerEventHandler_ = new PointerEventHandler(element);

		/**
		 * Event handler which generates pointer events for
		 * the document (used when dragging).
		 *
		 * @type {module:ol/pointer/PointerEventHandler}
		 * @private
		 */
		this.documentPointerEventHandler_ = null;

		/**
		 * @type {?module:ol/events~EventsKey}
		 * @private
		 */
		this.pointerdownListenerKey_ = listen(this.pointerEventHandler_,
			PointerEventType.POINTERDOWN,
			this.handlePointerDown_ as any, this);

		/**
		 * @type {?module:ol/events~EventsKey}
		 * @private
		 */
		this.relayedListenerKey_ = listen(this.pointerEventHandler_,
			PointerEventType.POINTERMOVE,
			this.relayEvent_ as any, this);

	}

	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		if (this.relayedListenerKey_) {
			unlistenByKey(this.relayedListenerKey_);
			this.relayedListenerKey_ = null;
		}
		if (this.pointerdownListenerKey_) {
			unlistenByKey(this.pointerdownListenerKey_);
			this.pointerdownListenerKey_ = null;
		}

		this.dragListenerKeys_.forEach(unlistenByKey);
		this.dragListenerKeys_.length = 0;

		if (this.documentPointerEventHandler_) {
			this.documentPointerEventHandler_.dispose();
			this.documentPointerEventHandler_ = null;
		}
		if (this.pointerEventHandler_) {
			this.pointerEventHandler_.dispose();
			this.pointerEventHandler_ = null;
		}
		EventTarget.prototype.disposeInternal.call(this);
	}


	/**
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @private
	 */
	private emulateClick_(pointerEvent: PointerEvent) {
		const newEvent = new MapBrowserPointerEvent(
			MapBrowserEventType.CLICK, this.map_, pointerEvent);
		this.dispatchEvent(newEvent);
		if (this.clickTimeoutId_ !== 0) {
			// double-click
			clearTimeout(this.clickTimeoutId_);
			this.clickTimeoutId_ = 0;
			const ne = new MapBrowserPointerEvent(
				MapBrowserEventType.DBLCLICK, this.map_, pointerEvent);
			this.dispatchEvent(ne);
		} else {
			// click
			this.clickTimeoutId_ = setTimeout(() => {
				this.clickTimeoutId_ = 0;
				const ne = new MapBrowserPointerEvent(
					MapBrowserEventType.SINGLECLICK, this.map_, pointerEvent);
				this.dispatchEvent(ne);
			}, 250);
		}
	}


	/**
	 * Keeps track on how many pointers are currently active.
	 *
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @private
	 */
	private updateActivePointers_(pointerEvent: PointerEvent) {
		const event = pointerEvent;

		if (event.type === MapBrowserEventType.POINTERUP ||
			event.type === MapBrowserEventType.POINTERCANCEL) {
			delete this.trackedTouches_[event.pointerId!];
		} else if (event.type === MapBrowserEventType.POINTERDOWN) {
			this.trackedTouches_[event.pointerId!] = true;
		}
		this.activePointers_ = Object.keys(this.trackedTouches_).length;
	}


	/**
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @private
	 */
	private handlePointerUp_(pointerEvent: PointerEvent) {
		this.updateActivePointers_(pointerEvent);
		const newEvent = new MapBrowserPointerEvent(
			MapBrowserEventType.POINTERUP, this.map_, pointerEvent);
		this.dispatchEvent(newEvent);

		// We emulate click events on left mouse button click, touch contact, and pen
		// contact. isMouseActionButton returns true in these cases (evt.button is set
		// to 0).
		// See http://www.w3.org/TR/pointerevents/#button-states
		// We only fire click, singleclick, and doubleclick if nobody has called
		// event.stopPropagation() or event.preventDefault().
		if (!newEvent.propagationStopped && !this.dragging_ && this.isMouseActionButton_(pointerEvent)) {
			this.emulateClick_(this.down_!);
		}

		if (this.activePointers_ === 0) {
			this.dragListenerKeys_.forEach(unlistenByKey);
			this.dragListenerKeys_.length = 0;
			this.dragging_ = false;
			this.down_ = null;
			this.documentPointerEventHandler_!.dispose();
			this.documentPointerEventHandler_ = null;
		}
	}


	/**
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @return {boolean} If the left mouse button was pressed.
	 * @private
	 */
	private isMouseActionButton_(pointerEvent: PointerEvent) {
		return pointerEvent.button === 0;
	}


	/**
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @private
	 */
	private handlePointerDown_(pointerEvent: PointerEvent) {
		this.updateActivePointers_(pointerEvent);
		const newEvent = new MapBrowserPointerEvent(
			MapBrowserEventType.POINTERDOWN, this.map_, pointerEvent);
		this.dispatchEvent(newEvent);

		this.down_ = pointerEvent;

		if (this.dragListenerKeys_.length === 0) {
			/* Set up a pointer event handler on the `document`,
			 * which is required when the pointer is moved outside
			 * the viewport when dragging.
			 */
			this.documentPointerEventHandler_ =
				new PointerEventHandler(document);

			this.dragListenerKeys_.push(
				listen(this.documentPointerEventHandler_,
					MapBrowserEventType.POINTERMOVE,
					this.handlePointerMove_ as any, this)!,
				listen(this.documentPointerEventHandler_,
					MapBrowserEventType.POINTERUP,
					this.handlePointerUp_ as any, this)!,
				/* Note that the listener for `pointercancel is set up on
				 * `pointerEventHandler_` and not `documentPointerEventHandler_` like
				 * the `pointerup` and `pointermove` listeners.
				 *
				 * The reason for this is the following: `TouchSource.vacuumTouches_()`
				 * issues `pointercancel` events, when there was no `touchend` for a
				 * `touchstart`. Now, let's say a first `touchstart` is registered on
				 * `pointerEventHandler_`. The `documentPointerEventHandler_` is set up.
				 * But `documentPointerEventHandler_` doesn't know about the first
				 * `touchstart`. If there is no `touchend` for the `touchstart`, we can
				 * only receive a `touchcancel` from `pointerEventHandler_`, because it is
				 * only registered there.
				 */
				listen(this.pointerEventHandler_!,
					MapBrowserEventType.POINTERCANCEL,
					this.handlePointerUp_ as any, this)!
			);
		}
	}


	/**
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @private
	 */
	private handlePointerMove_(pointerEvent: PointerEvent) {
		// Between pointerdown and pointerup, pointermove events are triggered.
		// To avoid a 'false' touchmove event to be dispatched, we test if the pointer
		// moved a significant distance.
		if (this.isMoving_(pointerEvent)) {
			this.dragging_ = true;
			const newEvent = new MapBrowserPointerEvent(
				MapBrowserEventType.POINTERDRAG, this.map_, pointerEvent,
				this.dragging_);
			this.dispatchEvent(newEvent);
		}

		// Some native android browser triggers mousemove events during small period
		// of time. See: https://code.google.com/p/android/issues/detail?id=5491 or
		// https://code.google.com/p/android/issues/detail?id=19827
		// ex: Galaxy Tab P3110 + Android 4.1.1
		pointerEvent.preventDefault();
	}


	/**
	 * Wrap and relay a pointer event.  Note that this requires that the type
	 * string for the MapBrowserPointerEvent matches the PointerEvent type.
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @private
	 */
	private relayEvent_(pointerEvent: PointerEvent) {
		const dragging = !!(this.down_ && this.isMoving_(pointerEvent));
		this.dispatchEvent(new MapBrowserPointerEvent(
			pointerEvent.type, this.map_, pointerEvent, dragging));
	}


	/**
	 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
	 * event.
	 * @return {boolean} Is moving.
	 * @private
	 */
	private isMoving_(pointerEvent: PointerEvent) {
		return Math.abs(pointerEvent.clientX! - this.down_!.clientX!) > this.moveTolerance_ ||
			Math.abs(pointerEvent.clientY! - this.down_!.clientY!) > this.moveTolerance_;
	}

}
