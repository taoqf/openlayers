/**
 * @module ol/control/Zoom
 */
import Control from '../control/Control';
import { CLASS_CONTROL, CLASS_UNSELECTABLE } from '../css';
import { easeOut } from '../easing';
import { listen } from '../events';
import Event from '../events/Event';
import EventType from '../events/EventType';

/**
 * @typedef {Object} Options
 * @property {number} [duration=250] Animation duration in milliseconds.
 * @property {string} [className='ol-zoom'] CSS class name.
 * @property {string|Element} [zoomInLabel='+'] Text label to use for the zoom-in
 * button. Instead of text, also an element (e.g. a `span` element) can be used.
 * @property {string|Element} [zoomOutLabel='-'] Text label to use for the zoom-out button.
 * Instead of text, also an element (e.g. a `span` element) can be used.
 * @property {string} [zoomInTipLabel='Zoom in'] Text label to use for the button tip.
 * @property {string} [zoomOutTipLabel='Zoom out'] Text label to use for the button tip.
 * @property {number} [delta=1] The zoom delta applied on each click.
 * @property {Element|string} [target] Specify a target if you want the control to be
 * rendered outside of the map's viewport.
 */

export interface Options {
	duration: number;
	className: string;
	zoomInLabel: string | HTMLElement;
	zoomOutLabel: string | HTMLElement;
	zoomInTipLabel: string;
	zoomOutTipLabel: string;
	delta: number;
	target: string | HTMLElement;
}

/**
 * @classdesc
 * A control with 2 buttons, one for zoom in and one for zoom out.
 * This control is one of the default controls of a map. To style this control
 * use css selectors `.ol-zoom-in` and `.ol-zoom-out`.
 *
 * @constructor
 * @extends {module:ol/control/Control}
 * @param {module:ol/control/Zoom~Options=} opt_options Zoom options.
 * @api
 */
export default class Zoom extends Control {
	private duration_: number;
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options ? opt_options : {};

		const className = options.className !== undefined ? options.className : 'ol-zoom';

		const delta = options.delta !== undefined ? options.delta : 1;

		const zoomInLabel = options.zoomInLabel !== undefined ? options.zoomInLabel : '+';
		const zoomOutLabel = options.zoomOutLabel !== undefined ? options.zoomOutLabel : '\u2212';

		const zoomInTipLabel = options.zoomInTipLabel !== undefined ?
			options.zoomInTipLabel : 'Zoom in';
		const zoomOutTipLabel = options.zoomOutTipLabel !== undefined ?
			options.zoomOutTipLabel : 'Zoom out';

		const inElement = document.createElement('button');
		inElement.className = className + '-in';
		inElement.setAttribute('type', 'button');
		inElement.title = zoomInTipLabel;
		inElement.appendChild(
			typeof zoomInLabel === 'string' ? document.createTextNode(zoomInLabel) : zoomInLabel
		);

		listen(inElement, EventType.CLICK, (e: Event) => {
			this.handleClick_(delta, e);
		});

		const outElement = document.createElement('button');
		outElement.className = className + '-out';
		outElement.setAttribute('type', 'button');
		outElement.title = zoomOutTipLabel;
		outElement.appendChild(
			typeof zoomOutLabel === 'string' ? document.createTextNode(zoomOutLabel) : zoomOutLabel
		);

		listen(outElement, EventType.CLICK, (e: Event) => {
			this.handleClick_(-delta, e);
		});

		const cssClasses = className + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;
		const element = document.createElement('div');
		element.className = cssClasses;
		element.appendChild(inElement);
		element.appendChild(outElement);

		super({
			element,
			target: options.target
		});

		/**
		 * @type {number}
		 * @private
		 */
		this.duration_ = options.duration !== undefined ? options.duration : 250;

	}

	/**
	 * @param {number} delta Zoom delta.
	 * @param {Event} event The event to handle
	 * @private
	 */
	private handleClick_(delta: number, event: Event) {
		event.preventDefault();
		this.zoomByDelta_(delta);
	}


	/**
	 * @param {number} delta Zoom delta.
	 * @private
	 */
	private zoomByDelta_(delta: number) {
		const map = this.getMap()!;
		const view = map.getView();
		if (!view) {
			// the map does not have a view, so we can't act
			// upon it
			return;
		}
		const currentResolution = view.getResolution();
		if (currentResolution) {
			const newResolution = view.constrainResolution(currentResolution, delta);
			if (this.duration_ > 0) {
				if (view.getAnimating()) {
					view.cancelAnimations();
				}
				view.animate({
					duration: this.duration_,
					easing: easeOut,
					resolution: newResolution
				});
			} else {
				view.setResolution(newResolution);
			}
		}
	}
}
