/**
 * @module ol/events/EventType
 */

/**
 * @enum {string}
 * @const
 */
export default {
	/**
	 * Generic change event. Triggered when the revision counter is increased.
	 * @event module:ol/events/Event~Event#change
	 * @api
	 */
	CHANGE: 'change',

	CLEAR: 'clear',
	CLICK: 'click',
	CONTEXTMENU: 'contextmenu',
	DBLCLICK: 'dblclick',
	DRAGENTER: 'dragenter',
	DRAGOVER: 'dragover',
	DROP: 'drop',
	ERROR: 'error',
	KEYDOWN: 'keydown',
	KEYPRESS: 'keypress',
	LOAD: 'load',
	MOUSEDOWN: 'mousedown',
	MOUSEMOVE: 'mousemove',
	MOUSEOUT: 'mouseout',
	MOUSEUP: 'mouseup',
	MOUSEWHEEL: 'mousewheel',
	MSPOINTERDOWN: 'MSPointerDown',
	RESIZE: 'resize',
	TOUCHEND: 'touchend',
	TOUCHMOVE: 'touchmove',
	TOUCHSTART: 'touchstart',
	WHEEL: 'wheel'
};
