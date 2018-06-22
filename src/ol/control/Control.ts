/**
 * @module ol/control/Control
 */
import { removeNode } from '../dom';
import { EventsKey, listen, unlistenByKey } from '../events';
import { UNDEFINED } from '../functions';
import MapEvent from '../MapEvent';
import MapEventType from '../MapEventType';
import BaseObject from '../Object';
import PluggableMap from '../PluggableMap';

/**
 * @typedef {Object} Options
 * @property {Element} [element] The element is the control's
 * container element. This only needs to be specified if you're developing
 * a custom control.
 * @property {function(module:ol/MapEvent)} [render] Function called when
 * the control should be re-rendered. This is called in a `requestAnimationFrame`
 * callback.
 * @property {Element|string} [target] Specify a target if you want
 * the control to be rendered outside of the map's viewport.
 */

export interface ControlOptions {
	element: HTMLElement;
	target: string | HTMLElement;
	render(e: MapEvent): void;
}

/**
 * @classdesc
 * A control is a visible widget with a DOM element in a fixed position on the
 * screen. They can involve user input (buttons), or be informational only;
 * the position is determined using CSS. By default these are placed in the
 * container with CSS class name `ol-overlaycontainer-stopevent`, but can use
 * any outside DOM element.
 *
 * This is the base class for controls. You can use it for simple custom
 * controls by creating the element with listeners, creating an instance:
 * ```js
 * var myControl = new Control({element: myElement});
 * ```
 * and then adding this to the map.
 *
 * The main advantage of having this as a control rather than a simple separate
 * DOM element is that preventing propagation is handled for you. Controls
 * will also be objects in a {@link module:ol/Collection~Collection}, so you can use their methods.
 *
 * You can also extend this base for your own control class. See
 * examples/custom-controls for an example of how to do this.
 *
 * @constructor
 * @extends {module:ol/Object}
 * @param {module:ol/control/Control~Options} options Control options.
 * @api
 */
export default class Control extends BaseObject {
	/**
	 * @protected
	 * @type {Element}
	 */
	protected element: HTMLElement;
	protected listenerKeys: EventsKey[];
	protected render: (e: MapEvent) => void;
	/**
	 * @private
	 * @type {Element}
	 */
	private target: HTMLElement | null;
	/**
	 * @private
	 * @type {module:ol/PluggableMap}
	 */
	private map: PluggableMap | null;
	constructor(options: Partial<ControlOptions>) {
		super();

		this.element = options.element ? options.element : null as any;

		this.target = null;

		this.map = null;

		/**
		 * @protected
		 * @type {!Array.<module:ol/events~EventsKey>}
		 */
		this.listenerKeys = [];

		/**
		 * @type {function(module:ol/MapEvent)}
		 */
		this.render = options.render ? options.render : UNDEFINED;

		if (options.target) {
			this.setTarget(options.target);
		}
	}
	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		removeNode(this.element);
		BaseObject.prototype.disposeInternal.call(this);
	}


	/**
	 * Get the map associated with this control.
	 * @return {module:ol/PluggableMap} Map.
	 * @api
	 */
	public getMap() {
		return this.map;
	}


	/**
	 * Remove the control from its current map and attach it to the new map.
	 * Subclasses may set up event handlers to get notified about changes to
	 * the map here.
	 * @param {module:ol/PluggableMap} map Map.
	 * @api
	 */
	public setMap(map: PluggableMap) {
		if (this.map) {
			removeNode(this.element!);
		}
		for (let i = 0, ii = this.listenerKeys.length; i < ii; ++i) {
			unlistenByKey(this.listenerKeys[i]);
		}
		this.listenerKeys.length = 0;
		this.map = map;
		if (this.map) {
			const target = this.target ?
				this.target : map.getOverlayContainerStopEvent();
			target.appendChild(this.element);
			if (this.render !== UNDEFINED) {
				this.listenerKeys.push(listen(map,
					MapEventType.POSTRENDER, (e) => {
						this.render(e as MapEvent);
					}, this)!);
			}
			map.render();
		}
	}

	/**
	 * This function is used to set a target element for the control. It has no
	 * effect if it is called after the control has been added to the map (i.e.
	 * after `setMap` is called on the control). If no `target` is set in the
	 * options passed to the control constructor and if `setTarget` is not called
	 * then the control is added to the map's overlay container.
	 * @param {Element|string} target Target.
	 * @api
	 */
	public setTarget(target: HTMLElement | string) {
		this.target = typeof target === 'string' ?
			document.getElementById(target)! :
			target;
	}
}

