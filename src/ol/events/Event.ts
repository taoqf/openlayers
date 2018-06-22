/**
 * @module ol/events/Event
 */
/**
 * @classdesc
 * Stripped down implementation of the W3C DOM Level 2 Event interface.
 * @see {@link https://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-interface}
 *
 * This implementation only provides `type` and `target` properties, and
 * `stopPropagation` and `preventDefault` methods. It is meant as base class
 * for higher level events defined in the library, and works with
 * {@link module:ol/events/EventTarget~EventTarget}.
 */
export default class Event {
	public propagationStopped = false;
	/**
	 * The event type.
	 * @type {string}
	 * @api
	 */
	public type: string;
	/**
	 * The event target.
	 * @type {Object}
	 * @api
	 */
	public target = null as any;
	/**
	 * @constructor
	 * @param type Type
	 */
	constructor(type: string) {
		this.type = type;
	}
	/**
	 * Stop event propagation.
	 * @function
	 * @api
	 */
	public preventDefault() {
		return this.stopPropagation();
	}

	/**
	 * Stop event propagation.
	 * @function
	 * @api
	 */
	public stopPropagation() {
		this.propagationStopped = true;
	}
}

/**
 * @param {Event|module:ol/events/Event} evt Event
 */
export function stopPropagation(evt: Event) {
	evt.stopPropagation();
}

/**
 * @param {Event|module:ol/events/Event} evt Event
 */
export function preventDefault(evt: Event) {
	evt.preventDefault();
}
