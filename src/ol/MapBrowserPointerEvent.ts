/**
 * @module ol/MapBrowserPointerEvent
 */
import MapBrowserEvent from './MapBrowserEvent';
import PluggableMap, { FrameState } from './PluggableMap';
import PointerEvent from './pointer/PointerEvent';

/**
 * @constructor
 * @extends {module:ol/MapBrowserEvent}
 * @param {string} type Event type.
 * @param {module:ol/PluggableMap} map Map.
 * @param {module:ol/pointer/PointerEvent} pointerEvent Pointer
 * event.
 * @param {boolean=} opt_dragging Is the map currently being dragged?
 * @param {?module:ol/PluggableMap~FrameState=} opt_frameState Frame state.
 */
export default class MapBrowserPointerEvent extends MapBrowserEvent {
	public pointerEvent: PointerEvent;
	constructor(type: string, map: PluggableMap, pointerEvent: PointerEvent, opt_dragging?: boolean, opt_frameState?: FrameState) {

		super(type, map, pointerEvent.originalEvent, opt_dragging,
			opt_frameState);

		/**
		 * @const
		 * @type {module:ol/pointer/PointerEvent}
		 */
		this.pointerEvent = pointerEvent;
	}
}
