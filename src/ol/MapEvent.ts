/**
 * @module ol/MapEvent
 */
import Event from './events/Event';
import PluggableMap, { FrameState } from './PluggableMap';

/**
 * @classdesc
 * Events emitted as map events are instances of this type.
 * See {@link module:ol/Map~Map} for which events trigger a map event.
 *
 * @constructor
 * @extends {module:ol/events/Event}
 * @param {string} type Event type.
 * @param {module:ol/PluggableMap} map Map.
 * @param {?module:ol/PluggableMap~FrameState=} opt_frameState Frame state.
 */
export default class MapEvent extends Event {
	public map: PluggableMap;
	public frameState: FrameState | null;
	constructor(type: string, map: PluggableMap, opt_frameState?: FrameState) {
		super(type);

		/**
		 * The map where the event occurred.
		 * @type {module:ol/PluggableMap}
		 * @api
		 */
		this.map = map;

		/**
		 * The frame state at the time of the event.
		 * @type {?module:ol/PluggableMap~FrameState}
		 * @api
		 */
		this.frameState = opt_frameState !== undefined ? opt_frameState : null;

	}
}
