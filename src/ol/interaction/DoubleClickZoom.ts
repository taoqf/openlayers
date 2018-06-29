/**
 * @module ol/interaction/DoubleClickZoom
 */
import Interaction, { zoomByDelta } from '../interaction/Interaction';
import MapBrowserEvent from '../MapBrowserEvent';
import MapBrowserEventType from '../MapBrowserEventType';


/**
 * @typedef {Object} Options
 * @property {number} [duration=250] Animation duration in milliseconds.
 * @property {number} [delta=1] The zoom delta applied on each double click.
 */

export interface Options {
	duration: number;
	delta: number;
}

/**
 * @classdesc
 * Allows the user to zoom by double-clicking on the map.
 *
 * @constructor
 * @extends {module:ol/interaction/Interaction}
 * @param {module:ol/interaction/DoubleClickZoom~Options=} opt_options Options.
 * @api
 */
export default class DoubleClickZoom extends Interaction {
	private delta_: number;
	private duration_: number;
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options ? opt_options : {};

		super({
			handleEvent: (e) => {
				return this._handleEvent(e);
			}
		});
		this.delta_ = options.delta ? options.delta : 1;

		/**
		 * @private
		 * @type {number}
		 */
		this.duration_ = options.duration !== undefined ? options.duration : 250;

	}

	/**
	 * Handles the {@link module:ol/MapBrowserEvent map browser event} (if it was a
	 * doubleclick) and eventually zooms the map.
	 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
	 * @return {boolean} `false` to stop event propagation.
	 * @this {module:ol/interaction/DoubleClickZoom}
	 */
	private _handleEvent(mapBrowserEvent: MapBrowserEvent) {
		let stopEvent = false;
		const browserEvent = mapBrowserEvent.originalEvent as MouseEvent;
		if (mapBrowserEvent.type === MapBrowserEventType.DBLCLICK) {
			const map = mapBrowserEvent.map;
			const anchor = mapBrowserEvent.coordinate;
			const delta = browserEvent.shiftKey ? -this.delta_ : this.delta_;
			const view = map.getView();
			zoomByDelta(view, delta, anchor!, this.duration_);
			mapBrowserEvent.preventDefault();
			stopEvent = true;
		}
		return !stopEvent;
	}
}
