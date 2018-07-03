/**
 * @module ol/control/Rotate
 */

import Control from '../control/Control';
import { CLASS_CONTROL, CLASS_HIDDEN, CLASS_UNSELECTABLE } from '../css';
import { easeOut } from '../easing';
import { listen } from '../events';
import Event from '../events/Event';
import EventType from '../events/EventType';
import MapEvent from '../MapEvent';


/**
 * @typedef {Object} Options
 * @property {string} [className='ol-rotate'] CSS class name.
 * @property {string|Element} [label='⇧'] Text label to use for the rotate button.
 * Instead of text, also an element (e.g. a `span` element) can be used.
 * @property {string} [tipLabel='Reset rotation'] Text label to use for the rotate tip.
 * @property {number} [duration=250] Animation duration in milliseconds.
 * @property {boolean} [autoHide=true] Hide the control when rotation is 0.
 * @property {function(module:ol/MapEvent)} [render] Function called when the control should
 * be re-rendered. This is called in a `requestAnimationFrame` callback.
 * @property {function()} [resetNorth] Function called when the control is clicked.
 * This will override the default `resetNorth`.
 * @property {Element|string} [target] Specify a target if you want the control to be
 * rendered outside of the map's viewport.
 */

export interface Options {
	className: string;
	label: string | HTMLElement;
	tipLabel: string;
	duration: number;
	autoHide: boolean;
	target: HTMLElement | string;
	render(e: MapEvent): void;
	resetNorth(): void;
}

/**
 * @classdesc
 * A button control to reset rotation to 0.
 * To style this control use css selector `.ol-rotate`. A `.ol-hidden` css
 * selector is added to the button when the rotation is 0.
 *
 * @constructor
 * @extends {module:ol/control/Control}
 * @param {module:ol/control/Rotate~Options=} opt_options Rotate options.
 * @api
 */
export default class Rotate extends Control {
	/**
	 * @type {Element}
	 * @private
	 */
	private label_: HTMLElement;
	private callResetNorth_: (() => void) | undefined;
	/**
	 * @type {number}
	 * @private
	 */
	private duration_: number;
	/**
	 * @type {boolean}
	 * @private
	 */
	private autoHide_: boolean;
	/**
	 * @private
	 * @type {number|undefined}
	 */
	private rotation_: number | undefined;
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options ? opt_options : {};

		const className = options.className !== undefined ? options.className : 'ol-rotate';

		const label = options.label !== undefined ? options.label : '\u21E7';

		const label_dom = (() => {
			if (typeof label === 'string') {
				const lb = document.createElement('span');
				lb.className = 'ol-compass';
				lb.textContent = label;
				return lb;
			} else {
				const lb = label;
				lb.classList.add('ol-compass');
				return lb;
			}
		})();


		const tipLabel = options.tipLabel ? options.tipLabel : 'Reset rotation';

		const button = document.createElement('button');
		button.className = className + '-reset';
		button.setAttribute('type', 'button');
		button.title = tipLabel;
		button.appendChild(label_dom);

		listen(button, EventType.CLICK, (e: Event) => {
			return this.handleClick_(e);
		});

		const cssClasses = className + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;
		const element = document.createElement('div');
		element.className = cssClasses;
		element.appendChild(button);

		/**
		 * Update the rotate control element.
		 * @param {module:ol/MapEvent} mapEvent Map event.
		 * @this {module:ol/control/Rotate}
		 * @api
		 */
		super({
			element,
			render: options.render || ((mapEvent: MapEvent) => {
				const frameState = mapEvent.frameState;
				if (!frameState) {
					return;
				}
				const rotation = frameState.viewState.rotation;
				if (rotation !== this.rotation_) {
					const transform = 'rotate(' + rotation + 'rad)';
					if (this.autoHide_) {
						const contains = this.element.classList.contains(CLASS_HIDDEN);
						if (!contains && rotation === 0) {
							this.element.classList.add(CLASS_HIDDEN);
						} else if (contains && rotation !== 0) {
							this.element.classList.remove(CLASS_HIDDEN);
						}
					}
					(this.label_.style as any).msTransform = transform;
					this.label_.style.webkitTransform = transform;
					this.label_.style.transform = transform;
				}
				this.rotation_ = rotation;
			}),
			target: options.target
		});

		this.label_ = label_dom;

		this.callResetNorth_ = options.resetNorth ? options.resetNorth : undefined;
		this.duration_ = options.duration !== undefined ? options.duration : 250;

		this.autoHide_ = options.autoHide !== undefined ? options.autoHide : true;

		this.rotation_ = undefined;

		if (this.autoHide_) {
			this.element.classList.add(CLASS_HIDDEN);
		}
	}

	/**
	 * @param {Event} event The event to handle
	 * @private
	 */
	private handleClick_(event: Event) {
		event.preventDefault();
		if (this.callResetNorth_ !== undefined) {
			this.callResetNorth_();
		} else {
			this.resetNorth_();
		}
	}

	private resetNorth_() {
		const map = this.getMap()!;
		const view = map.getView();
		if (!view) {
			// the map does not have a view, so we can't act
			// upon it
			return;
		}
		if (view.getRotation() !== undefined) {
			if (this.duration_ > 0) {
				view.animate({
					duration: this.duration_,
					easing: easeOut,
					rotation: 0
				});
			} else {
				view.setRotation(0);
			}
		}
	}
}
