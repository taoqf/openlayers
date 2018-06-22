/**
 * @module ol/events/EventTarget
 */
import Disposable from '../Disposable';
import { ListenerFunction, unlistenAll } from '../events';
import Event from '../events/Event';
import { UNDEFINED } from '../functions';
import EventTargetLike from './event-target-like';

/**
 * @classdesc
 * A simplified implementation of the W3C DOM Level 2 EventTarget interface.
 * @see {@link https://www.w3.org/TR/2000/REC-DOM-Level-2-Events-20001113/events.html#Events-EventTarget}
 *
 * There are two important simplifications compared to the specification:
 *
 * 1. The handling of `useCapture` in `addEventListener` and
 *    `removeEventListener`. There is no real capture model.
 * 2. The handling of `stopPropagation` and `preventDefault` on `dispatchEvent`.
 *    There is no event target hierarchy. When a listener calls
 *    `stopPropagation` or `preventDefault` on an event object, it means that no
 *    more listeners after this one will be called. Same as when the listener
 *    returns false.
 */
export default class EventTarget extends Disposable {
	/**
	 * @private
	 * @type {!Object.<string, number>}
	 */
	private pendingRemovals: { [s: string]: number; } = {};

	/**
	 * @private
	 * @type {!Object.<string, number>}
	 */
	private dispatching: { [s: string]: number; } = {};

	/**
	 * @private
	 * @type {!Object.<string, Array.<module:ol/events~ListenerFunction>>}
	 */
	private listeners: { [s: string]: ListenerFunction[]; } = {};

	/**
	 * @param {string} type Type.
	 * @param {module:ol/events~ListenerFunction} listener Listener.
	 */
	public addEventListener(type: string, listener: ListenerFunction) {
		let listeners = this.listeners[type];
		if (!listeners) {
			listeners = this.listeners[type] = [];
		}
		if (listeners.indexOf(listener) === -1) {
			listeners.push(listener);
		}
	}


	/**
	 * @param {{type: string,
	 *     target: (EventTarget|module:ol/events/EventTarget|undefined)}|module:ol/events/Event|
	 *     string} event Event or event type.
	 * @return {boolean|undefined} `false` if anyone called preventDefault on the
	 *     event object or if any of the listeners returned false.
	 */
	public dispatchEvent(event: string | Event | EventTargetLike) {
		const evt = typeof event === 'string' ? new Event(event) : event;
		const type = (evt as Event).type;
		(evt as Event).target = this;
		const listeners = this.listeners[type];
		let propagate = false;
		if (listeners) {
			if (!(type in this.dispatching)) {
				this.dispatching[type] = 0;
				this.pendingRemovals[type] = 0;
			}
			++this.dispatching[type];
			for (let i = 0, ii = listeners.length; i < ii; ++i) {
				if (listeners[i].call(this, evt) === false || (evt as Event).propagationStopped) {
					propagate = false;
					break;
				}
			}
			--this.dispatching[type];
			if (this.dispatching[type] === 0) {
				let pendingRemovals = this.pendingRemovals[type];
				delete this.pendingRemovals[type];
				while (pendingRemovals--) {
					this.removeEventListener(type, UNDEFINED);
				}
				delete this.dispatching[type];
			}
		}
		return propagate;
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		unlistenAll(this);
	}


	/**
	 * Get the listeners for a specified event type. Listeners are returned in the
	 * order that they will be called in.
	 *
	 * @param {string} type Type.
	 * @return {Array.<module:ol/events~ListenerFunction>} Listeners.
	 */
	public getListeners(type: string) {
		return this.listeners[type];
	}


	/**
	 * @param {string=} opt_type Type. If not provided,
	 *     `true` will be returned if this EventTarget has any listeners.
	 * @return {boolean} Has listeners.
	 */
	public hasListener(opt_type?: string): boolean {
		return opt_type ?
			opt_type in this.listeners :
			Object.keys(this.listeners).length > 0;
	}


	/**
	 * @param {string} type Type.
	 * @param {module:ol/events~ListenerFunction} listener Listener.
	 */
	public removeEventListener(type: string, listener: ListenerFunction) {
		const listeners = this.listeners[type];
		if (listeners) {
			const index = listeners.indexOf(listener);
			if (type in this.pendingRemovals) {
				// make listener a no-op, and remove later in #dispatchEvent()
				listeners[index] = UNDEFINED;
				++this.pendingRemovals[type];
			} else {
				listeners.splice(index, 1);
				if (listeners.length === 0) {
					delete this.listeners[type];
				}
			}
		}
	}
}
