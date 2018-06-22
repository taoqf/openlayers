/**
 * @module ol/control/FullScreen
 */
import Control from '../control/Control';
import { CLASS_CONTROL, CLASS_UNSELECTABLE, CLASS_UNSUPPORTED } from '../css';
import { replaceNode } from '../dom';
import { listen } from '../events';
import EventType from '../events/EventType';
import PluggableMap from '../PluggableMap';


/**
 * @return {string} Change type.
 */
const getChangeType = (() => {
	let changeType: 'webkitfullscreenchange' | 'mozfullscreenchange' | 'MSFullscreenChange' | 'fullscreenchange';
	return () => {
		if (!changeType) {
			const body = document.body;
			if (body.webkitRequestFullscreen) {
				changeType = 'webkitfullscreenchange';
			} else if ((body as any).mozRequestFullScreen) {
				changeType = 'mozfullscreenchange';
			} else if ((body as any).msRequestFullscreen) {
				changeType = 'MSFullscreenChange';
			} else if (body.requestFullscreen) {
				changeType = 'fullscreenchange';
			}
		}
		return changeType;
	};
})();

/**
 * @typedef {Object} Options
 * @property {string} [className='ol-full-screen'] CSS class name.
 * @property {string|Element} [label='\u2922'] Text label to use for the button.
 * Instead of text, also an element (e.g. a `span` element) can be used.
 * @property {string|Element} [labelActive='\u00d7'] Text label to use for the
 * button when full-screen is active.
 * Instead of text, also an element (e.g. a `span` element) can be used.
 * @property {string} [tipLabel='Toggle full-screen'] Text label to use for the button tip.
 * @property {boolean} [keys=false] Full keyboard access.
 * @property {Element|string} [target] Specify a target if you want the
 * control to be rendered outside of the map's viewport.
 * @property {Element|string} [source] The element to be displayed
 * fullscreen. When not provided, the element containing the map viewport will
 * be displayed fullscreen.
 */

export interface Options {
	className: string;
	label: string | HTMLElement;
	labelActive: string | HTMLElement;
	tipLabel: string;
	keys: boolean;
	target: string | HTMLElement;
	source: string | HTMLElement;
}

/**
 * @classdesc
 * Provides a button that when clicked fills up the full screen with the map.
 * The full screen source element is by default the element containing the map viewport unless
 * overridden by providing the `source` option. In which case, the dom
 * element introduced using this parameter will be displayed in full screen.
 *
 * When in full screen mode, a close button is shown to exit full screen mode.
 * The [Fullscreen API](http://www.w3.org/TR/fullscreen/) is used to
 * toggle the map in full screen mode.
 *
 *
 * @constructor
 * @extends {module:ol/control/Control}
 * @param {module:ol/control/FullScreen~Options=} opt_options Options.
 * @api
 */
export default class FullScreen extends Control {
	private cssClassName_: string;
	private labelNode_: HTMLElement | Text;
	private labelActiveNode_: HTMLElement | Text;
	private keys_: boolean;
	private source_: string | HTMLElement | undefined;
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options ? opt_options : {};
		const cssClassName_ = options.className !== undefined ? options.className :
			'ol-full-screen';

		const label = options.label !== undefined ? options.label : '\u2922';

		const labelNode_ = typeof label === 'string' ?
			document.createTextNode(label) : label;

		const labelActive = options.labelActive !== undefined ? options.labelActive : '\u00d7';

		const labelActiveNode_ = typeof labelActive === 'string' ?
			document.createTextNode(labelActive) : labelActive;

		const tipLabel = options.tipLabel ? options.tipLabel : 'Toggle full-screen';
		const button = document.createElement('button');
		button.className = cssClassName_ + '-' + isFullScreen();
		button.setAttribute('type', 'button');
		button.title = tipLabel;
		button.appendChild(labelNode_);

		const cssClasses = cssClassName_ + ' ' + CLASS_UNSELECTABLE +
			' ' + CLASS_CONTROL + ' ' +
			(!isFullScreenSupported() ? CLASS_UNSUPPORTED : '');
		const element = document.createElement('div');
		element.className = cssClasses;
		element.appendChild(button);

		super({
			element,
			target: options.target
		});
		listen(button, EventType.CLICK,
			this.handleClick_, this);

		/**
		 * @private
		 * @type {string}
		 */
		this.cssClassName_ = cssClassName_;
		/**
		 * @private
		 * @type {Element}
		 */
		this.labelNode_ = labelNode_;
		/**
		 * @private
		 * @type {Element}
		 */
		this.labelActiveNode_ = labelActiveNode_;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.keys_ = options.keys !== undefined ? options.keys : false;

		/**
		 * @private
		 * @type {Element|string|undefined}
		 */
		this.source_ = options.source;

	}

	/**
	 * @inheritDoc
	 * @api
	 */
	public setMap(map: PluggableMap) {
		super.setMap(map);
		if (map) {
			this.listenerKeys.push(listen(document, getChangeType(), this.handleFullScreenChange_, this)!
			);
		}
	}
	/**
	 * @param {Event} event The event to handle
	 * @private
	 */
	private handleClick_(event: Event) {
		event.preventDefault();
		this.handleFullScreen_();
	}

	/**
	 * @private
	 */
	private handleFullScreen_() {
		if (!isFullScreenSupported()) {
			return;
		}
		const map = this.getMap();
		if (!map) {
			return;
		}
		if (isFullScreen()) {
			exitFullScreen();
		} else {
			let element;
			if (this.source_) {
				element = typeof this.source_ === 'string' ?
					document.getElementById(this.source_) :
					this.source_;
			} else {
				element = map.getTargetElement();
			}
			if (this.keys_) {
				requestFullScreenWithKeys(element);

			} else {
				requestFullScreen(element);
			}
		}
	}

	/**
	 * @private
	 */
	private handleFullScreenChange_() {
		const button = this.element.firstElementChild;
		const map = this.getMap();
		if (isFullScreen()) {
			button!.className = this.cssClassName_ + '-true';
			replaceNode(this.labelActiveNode_, this.labelNode_);
		} else {
			button!.className = this.cssClassName_ + '-false';
			replaceNode(this.labelNode_, this.labelActiveNode_);
		}
		if (map) {
			map.updateSize();
		}
	}
}

/**
 * @return {boolean} Fullscreen is supported by the current platform.
 */
function isFullScreenSupported() {
	const body = document.body;
	return !!(
		body.webkitRequestFullscreen ||
		((body as any).mozRequestFullScreen && (document as any).mozFullScreenEnabled) ||
		((body as any).msRequestFullscreen && (document as any).msFullscreenEnabled) ||
		(body.requestFullscreen && document.fullscreenEnabled)
	);
}

/**
 * @return {boolean} Element is currently in fullscreen.
 */
function isFullScreen() {
	return !!(
		document.webkitIsFullScreen || (document as any).mozFullScreen ||
		(document as any).msFullscreenElement || document.fullscreenElement
	);
}

/**
 * Request to fullscreen an element.
 * @param {Element} element Element to request fullscreen
 */
function requestFullScreen(element: Element) {
	if (element.requestFullscreen) {
		element.requestFullscreen();
	} else if ((element as any).msRequestFullscreen) {
		(element as any).msRequestFullscreen();
	} else if ((element as any).mozRequestFullScreen) {
		(element as any).mozRequestFullScreen();
	} else if ((element as any).webkitRequestFullscreen) {
		(element as any).webkitRequestFullscreen();
	}
}

/**
 * Request to fullscreen an element with keyboard input.
 * @param {Element} element Element to request fullscreen
 */
function requestFullScreenWithKeys(element: Element) {
	if ((element as any).mozRequestFullScreenWithKeys) {
		(element as any).mozRequestFullScreenWithKeys();
	} else if ((element as any).webkitRequestFullscreen) {
		(element as any).webkitRequestFullscreen((Element as any).ALLOW_KEYBOARD_INPUT);
	} else {
		requestFullScreen(element);
	}
}

/**
 * Exit fullscreen.
 */
function exitFullScreen() {
	if (document.exitFullscreen) {
		document.exitFullscreen();
	} else if ((document as any).msExitFullscreen) {
		(document as any).msExitFullscreen();
	} else if ((document as any).mozCancelFullScreen) {
		(document as any).mozCancelFullScreen();
	} else if (document.webkitExitFullscreen) {
		document.webkitExitFullscreen();
	}
}
