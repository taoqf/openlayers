/**
 * @module ol/Observable
 */
import { EventsKey, listen, listenOnce, unlisten, unlistenByKey } from './events';
import Event from './events/Event';
import EventTarget from './events/EventTarget';
import EventType from './events/EventType';

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * An event target providing convenient methods for listener registration
 * and unregistration. A generic `change` event is always available through
 * {@link module:ol/Observable~Observable#changed}.
 *
 * @constructor
 * @extends {module:ol/events/EventTarget}
 * @fires module:ol/events/Event~Event
 * @struct
 * @api
 */
export default class Observable extends EventTarget {
	private revision: number;
	constructor() {
		super();
		/**
		 * @private
		 * @type {number}
		 */
		this.revision = 0;
	}



	/**
	 * Increases the revision counter and dispatches a 'change' event.
	 * @api
	 */
	public changed() {
		++this.revision;
		this.dispatchEvent(EventType.CHANGE);
	}


	/**
	 * Dispatches an event and calls all listeners listening for events
	 * of this type. The event parameter can either be a string or an
	 * Object with a `type` property.
	 *
	 * @param {{type: string,
	 *     target: (EventTarget|module:ol/events/EventTarget|undefined)}|
	 *     module:ol/events/Event|string} event Event object.
	 * @function
	 * @api
	 */
	public dispatchEvent(_type: string | Event) {
		return false;
	}

	/**
	 * Get the version number for this object.  Each time the object is modified,
	 * its version number will be incremented.
	 * @return {number} Revision.
	 * @api
	 */
	public getRevision() {
		return this.revision;
	}


	/**
	 * Listen for a certain type of event.
	 * @param {string|Array.<string>} type The event type or array of event types.
	 * @param {function(?): ?} listener The listener function.
	 * @return {module:ol/events~EventsKey|Array.<module:ol/events~EventsKey>} Unique key for the listener. If
	 *     called with an array of event types as the first argument, the return
	 *     will be an array of keys.
	 * @api
	 */
	public on(type: string | string[], listener: (...args: any[]) => any) {
		if (Array.isArray(type)) {
			const len = type.length;
			const keys = new Array(len);
			for (let i = 0; i < len; ++i) {
				keys[i] = listen(this, type[i], listener);
			}
			return keys;
		} else {
			return listen(this, /** @type {string} */(type), listener);
		}
	}


	/**
	 * Listen once for a certain type of event.
	 * @param {string|Array.<string>} type The event type or array of event types.
	 * @param {function(?): ?} listener The listener function.
	 * @return {module:ol/events~EventsKey|Array.<module:ol/events~EventsKey>} Unique key for the listener. If
	 *     called with an array of event types as the first argument, the return
	 *     will be an array of keys.
	 * @api
	 */
	public once(type: string | string[], listener: (...args: any[]) => any) {
		if (Array.isArray(type)) {
			const len = type.length;
			const keys = new Array(len);
			for (let i = 0; i < len; ++i) {
				keys[i] = listenOnce(this, type[i], listener);
			}
			return keys;
		} else {
			return listenOnce(this, /** @type {string} */(type), listener);
		}
	}


	/**
	 * Unlisten for a certain type of event.
	 * @param {string|Array.<string>} type The event type or array of event types.
	 * @param {function(?): ?} listener The listener function.
	 * @api
	 */
	public un(type: string | string[], listener: (...args: any[]) => any) {
		if (Array.isArray(type)) {
			for (let i = 0, ii = type.length; i < ii; ++i) {
				unlisten(this, type[i], listener);
			}
			return;
		} else {
			unlisten(this, /** @type {string} */(type), listener);
		}
	}

}

/**
 * Removes an event listener using the key returned by `on()` or `once()`.
 * @param {module:ol/events~EventsKey|Array.<module:ol/events~EventsKey>} key The key returned by `on()`
 *     or `once()` (or an array of keys).
 * @api
 */
export function unByKey(key: EventsKey | EventsKey[]) {
	if (Array.isArray(key)) {
		for (let i = 0, ii = key.length; i < ii; ++i) {
			unlistenByKey(key[i]);
		}
	} else {
		unlistenByKey(/** @type {module:ol/events~EventsKey} */(key));
	}
}
