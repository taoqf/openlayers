/**
 * @module ol/events/condition
 */
import { assert } from '../asserts';
import { MAC, WEBKIT } from '../has';
import MapBrowserEvent from '../MapBrowserEvent';
import MapBrowserEventType from '../MapBrowserEventType';
import MapBrowserPointerEvent from '../MapBrowserPointerEvent';
import PointerEvent from '../pointer/PointerEvent';


/**
 * A function that takes an {@link module:ol/MapBrowserEvent} and returns a
 * `{boolean}`. If the condition is met, true should be returned.
 *
 * @typedef {function(this: ?, module:ol/MapBrowserEvent): boolean} Condition
 */

export type Condition = (this: any, module: MapBrowserEvent) => boolean;

/**
 * Return `true` if only the alt-key is pressed, `false` otherwise (e.g. when
 * additionally the shift-key is pressed).
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if only the alt key is pressed.
 * @api
 */
export function altKeyOnly(mapBrowserEvent: MapBrowserEvent) {
	const originalEvent = mapBrowserEvent.originalEvent as PointerEvent;
	return (
		originalEvent.altKey &&
		!(originalEvent.metaKey || originalEvent.ctrlKey) &&
		!originalEvent.shiftKey);
}


/**
 * Return `true` if only the alt-key and shift-key is pressed, `false` otherwise
 * (e.g. when additionally the platform-modifier-key is pressed).
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if only the alt and shift keys are pressed.
 * @api
 */
export function altShiftKeysOnly(mapBrowserEvent: MapBrowserEvent) {
	const originalEvent = mapBrowserEvent.originalEvent as PointerEvent;
	return (
		originalEvent.altKey &&
		!(originalEvent.metaKey || originalEvent.ctrlKey) &&
		originalEvent.shiftKey);
}


/**
 * Return `true` if the map has the focus. This condition requires a map target
 * element with a `tabindex` attribute, e.g. `<div id="map" tabindex="1">`.
 *
 * @param {module:ol/MapBrowserEvent} event Map browser event.
 * @return {boolean} The map has the focus.
 * @api
 */
export function focus(event: MapBrowserEvent) {
	return event.target.getTargetElement() === document.activeElement;
}


/**
 * Return always true.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True.
 * @function
 * @api
 */
export function always(_e: MapBrowserEvent) {
	return true;
}


/**
 * Return `true` if the event is a `click` event, `false` otherwise.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if the event is a map `click` event.
 * @api
 */
export function click(mapBrowserEvent: MapBrowserEvent) {
	return mapBrowserEvent.type === MapBrowserEventType.CLICK;
}


/**
 * Return `true` if the event has an "action"-producing mouse button.
 *
 * By definition, this includes left-click on windows/linux, and left-click
 * without the ctrl key on Macs.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} The result.
 */
export function mouseActionButton(mapBrowserEvent: MapBrowserEvent) {
	const originalEvent = mapBrowserEvent.originalEvent as PointerEvent;
	return originalEvent.button === 0 &&
		!(WEBKIT && MAC && originalEvent.ctrlKey);
}


/**
 * Return always false.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} False.
 * @function
 * @api
 */
export function never(_e: MapBrowserEvent) {
	return false;
}


/**
 * Return `true` if the browser event is a `pointermove` event, `false`
 * otherwise.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if the browser event is a `pointermove` event.
 * @api
 */
export function pointerMove(mapBrowserEvent: MapBrowserEvent) {
	return mapBrowserEvent.type === 'pointermove';
}


/**
 * Return `true` if the event is a map `singleclick` event, `false` otherwise.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if the event is a map `singleclick` event.
 * @api
 */
export function singleClick(mapBrowserEvent: MapBrowserEvent) {
	return mapBrowserEvent.type === MapBrowserEventType.SINGLECLICK;
}


/**
 * Return `true` if the event is a map `dblclick` event, `false` otherwise.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if the event is a map `dblclick` event.
 * @api
 */
export function doubleClick(mapBrowserEvent: MapBrowserEvent) {
	return mapBrowserEvent.type === MapBrowserEventType.DBLCLICK;
}


/**
 * Return `true` if no modifier key (alt-, shift- or platform-modifier-key) is
 * pressed.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True only if there no modifier keys are pressed.
 * @api
 */
export function noModifierKeys(mapBrowserEvent: MapBrowserEvent) {
	const originalEvent = mapBrowserEvent.originalEvent as PointerEvent;
	return (
		!originalEvent.altKey &&
		!(originalEvent.metaKey || originalEvent.ctrlKey) &&
		!originalEvent.shiftKey);
}


/**
 * Return `true` if only the platform-modifier-key (the meta-key on Mac,
 * ctrl-key otherwise) is pressed, `false` otherwise (e.g. when additionally
 * the shift-key is pressed).
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if only the platform modifier key is pressed.
 * @api
 */
export function platformModifierKeyOnly(mapBrowserEvent: MapBrowserEvent) {
	const originalEvent = mapBrowserEvent.originalEvent as PointerEvent;
	return !originalEvent.altKey &&
		(MAC ? originalEvent.metaKey : originalEvent.ctrlKey) &&
		!originalEvent.shiftKey;
}


/**
 * Return `true` if only the shift-key is pressed, `false` otherwise (e.g. when
 * additionally the alt-key is pressed).
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if only the shift key is pressed.
 * @api
 */
export function shiftKeyOnly(mapBrowserEvent: MapBrowserEvent) {
	const originalEvent = mapBrowserEvent.originalEvent as PointerEvent;
	return (
		!originalEvent.altKey &&
		!(originalEvent.metaKey || originalEvent.ctrlKey) &&
		originalEvent.shiftKey);
}


/**
 * Return `true` if the target element is not editable, i.e. not a `<input>`-,
 * `<select>`- or `<textarea>`-element, `false` otherwise.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True only if the target element is not editable.
 * @api
 */
export function targetNotEditable(mapBrowserEvent: MapBrowserEvent) {
	const target = mapBrowserEvent.originalEvent.target;
	const tagName = target.tagName;
	return (
		tagName !== 'INPUT' &&
		tagName !== 'SELECT' &&
		tagName !== 'TEXTAREA');
}


/**
 * Return `true` if the event originates from a mouse device.
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if the event originates from a mouse device.
 * @api
 */
export function mouseOnly(mapBrowserEvent: MapBrowserPointerEvent) {
	assert(mapBrowserEvent.pointerEvent, 56); // mapBrowserEvent must originate from a pointer event
	// see http://www.w3.org/TR/pointerevents/#widl-PointerEvent-pointerType
	return (
			/** @type {module:ol/MapBrowserEvent} */ (mapBrowserEvent).pointerEvent.pointerType === 'mouse'
	);
}


/**
 * Return `true` if the event originates from a primary pointer in
 * contact with the surface or if the left mouse button is pressed.
 * @see http://www.w3.org/TR/pointerevents/#button-states
 *
 * @param {module:ol/MapBrowserEvent} mapBrowserEvent Map browser event.
 * @return {boolean} True if the event originates from a primary pointer.
 * @api
 */
export function primaryAction(mapBrowserEvent: MapBrowserPointerEvent) {
	const pointerEvent = mapBrowserEvent.pointerEvent;
	return pointerEvent.isPrimary && pointerEvent.button === 0;
}
