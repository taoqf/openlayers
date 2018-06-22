/**
 * @module ol/pointer/MouseSource
 */
// Based on https://github.com/Polymer/PointerEvents

// Copyright (c) 2013 The Polymer Authors. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
// * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
// * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { Pixel } from '../index';
import EventSource from '../pointer/EventSource';
import PointerEventHandler from './PointerEventHandler';


/**
 * @type {number}
 */
export const POINTER_ID = 1;


/**
 * Radius around touchend that swallows mouse events.
 *
 * @type {number}
 */
const DEDUP_DIST = 25;


/**
 * Creates a copy of the original event that will be used
 * for the fake pointer event.
 *
 * @param {Event} inEvent The in event.
 * @param {module:ol/pointer/PointerEventHandler} dispatcher Event handler.
 * @return {Object} The copied event.
 */
function prepareEvent(inEvent: Event, dispatcher: PointerEventHandler) {
	const e = dispatcher.cloneEvent(inEvent, inEvent);

	// forward mouse preventDefault
	const pd = e.preventDefault;
	e.preventDefault = () => {
		inEvent.preventDefault();
		pd();
	};

	e.pointerId = POINTER_ID;
	e.isPrimary = true;
	e.pointerType = POINTER_TYPE;

	return e;
}

/**
 * @type {string}
 */
export const POINTER_TYPE = 'mouse';

/**
 * @param {module:ol/pointer/PointerEventHandler} dispatcher Event handler.
 * @constructor
 * @extends {module:ol/pointer/EventSource}
 */
export default class MouseSource extends EventSource {
	public static prepareEvent(_arg0: any, _arg1: any): any {
		throw new Error('Method not implemented.');
	}
	public lastTouches: Pixel[];
	public pointerMap: { [key: string]: Event | any; };
	constructor(dispatcher: PointerEventHandler) {
		super(dispatcher, {
			mousedown(e) {
				return this.mousedown(e);
			},
			mousemove(e) {
				return this.mousemove(e);
			},
			mouseup(e) {
				return this.mouseup(e);
			},
			mouseover(e) {
				return this.mouseover(e);
			},
			mouseout(e) {
				return this.mouseout(e);
			}
		});

		/**
		 * @const
		 * @type {!Object.<string, Event|Object>}
		 */
		this.pointerMap = dispatcher.pointerMap;

		/**
		 * @const
		 * @type {Array.<module:ol~Pixel>}
		 */
		this.lastTouches = [];
	}

	/**
	 * Handler for `mousedown`.
	 *
	 * @param {Event} inEvent The in event.
	 */
	public mousedown(inEvent: Event) {
		if (!this.isEventSimulatedFromTouch_(inEvent)) {
			// TODO(dfreedman) workaround for some elements not sending mouseup
			// http://crbug/149091
			if (POINTER_ID.toString() in this.pointerMap) {
				this.cancel(inEvent);
			}
			const e = prepareEvent(inEvent, this.dispatcher);
			this.pointerMap[POINTER_ID.toString()] = inEvent;
			this.dispatcher.down(e, inEvent);
		}
	}


	/**
	 * Handler for `mousemove`.
	 *
	 * @param {Event} inEvent The in event.
	 */
	public mousemove(inEvent: Event) {
		if (!this.isEventSimulatedFromTouch_(inEvent)) {
			const e = prepareEvent(inEvent, this.dispatcher);
			this.dispatcher.move(e, inEvent);
		}
	}


	/**
	 * Handler for `mouseup`.
	 *
	 * @param {Event} inEvent The in event.
	 */
	public mouseup(inEvent: Event) {
		if (!this.isEventSimulatedFromTouch_(inEvent)) {
			const p = this.pointerMap[POINTER_ID.toString()];

			if (p && p.button === (inEvent as any).button) {
				const e = prepareEvent(inEvent, this.dispatcher);
				this.dispatcher.up(e, inEvent);
				this.cleanupMouse();
			}
		}
	}


	/**
	 * Handler for `mouseover`.
	 *
	 * @param {Event} inEvent The in event.
	 */
	public mouseover(inEvent: Event) {
		if (!this.isEventSimulatedFromTouch_(inEvent)) {
			const e = prepareEvent(inEvent, this.dispatcher);
			this.dispatcher.enterOver(e, inEvent);
		}
	}


	/**
	 * Handler for `mouseout`.
	 *
	 * @param {Event} inEvent The in event.
	 */
	public mouseout(inEvent: Event) {
		if (!this.isEventSimulatedFromTouch_(inEvent)) {
			const e = prepareEvent(inEvent, this.dispatcher);
			this.dispatcher.leaveOut(e, inEvent);
		}
	}


	/**
	 * Dispatches a `pointercancel` event.
	 *
	 * @param {Event} inEvent The in event.
	 */
	public cancel(inEvent: Event) {
		const e = prepareEvent(inEvent, this.dispatcher);
		this.dispatcher.cancel(e, inEvent);
		this.cleanupMouse();
	}


	/**
	 * Remove the mouse from the list of active pointers.
	 */
	public cleanupMouse() {
		delete this.pointerMap[POINTER_ID.toString()];
	}

	/**
	 * Detect if a mouse event was simulated from a touch by
	 * checking if previously there was a touch event at the
	 * same position.
	 *
	 * FIXME - Known problem with the native Android browser on
	 * Samsung GT-I9100 (Android 4.1.2):
	 * In case the page is scrolled, this function does not work
	 * correctly when a canvas is used (WebGL or canvas renderer).
	 * Mouse listeners on canvas elements (for this browser), create
	 * two mouse events: One 'good' and one 'bad' one (on other browsers or
	 * when a div is used, there is only one event). For the 'bad' one,
	 * clientX/clientY and also pageX/pageY are wrong when the page
	 * is scrolled. Because of that, this function can not detect if
	 * the events were simulated from a touch event. As result, a
	 * pointer event at a wrong position is dispatched, which confuses
	 * the map interactions.
	 * It is unclear, how one can get the correct position for the event
	 * or detect that the positions are invalid.
	 *
	 * @private
	 * @param {Event} inEvent The in event.
	 * @return {boolean} True, if the event was generated by a touch.
	 */
	private isEventSimulatedFromTouch_(inEvent: Event) {
		const lts = this.lastTouches;
		const x = (inEvent as any).clientX;
		const y = (inEvent as any).clientY;
		for (let i = 0, l = lts.length; i < l && lts[i]; i++) {
			const t = lts[i];
			// simulated mouse events will be swallowed near a primary touchend
			const dx = Math.abs(x - t[0]);
			const dy = Math.abs(y - t[1]);
			if (dx <= DEDUP_DIST && dy <= DEDUP_DIST) {
				return true;
			}
		}
		return false;
	}
}
