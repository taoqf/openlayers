import Event from '../events/Event';
import PointerEventHandler from './PointerEventHandler';

/**
 * @module ol/pointer/EventSource
 */
/**
 * @param {module:ol/pointer/PointerEventHandler} dispatcher Event handler.
 * @param {!Object.<string, function(Event)>} mapping Event mapping.
 * @constructor
 */
export default class EventSource {
	public dispatcher: PointerEventHandler;
	private mapping_: { [key: string]: (e: Event) => void; };
	constructor(dispatcher: PointerEventHandler, mapping: { [key: string]: (e: Event) => void; }) {
		/**
		 * @type {module:ol/pointer/PointerEventHandler}
		 */
		this.dispatcher = dispatcher;

		/**
		 * @private
		 * @const
		 * @type {!Object.<string, function(Event)>}
		 */
		this.mapping_ = mapping;
	}


	/**
	 * List of events supported by this source.
	 * @return {Array.<string>} Event names
	 */
	public getEvents() {
		return Object.keys(this.mapping_);
	}


	/**
	 * Returns the handler that should handle a given event type.
	 * @param {string} eventType The event type.
	 * @return {function(Event)} Handler
	 */
	public getHandlerForEvent(eventType: string) {
		return this.mapping_[eventType];
	}
}
