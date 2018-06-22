/**
 * @module ol/pointer/MsSource
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

import EventSource from '../pointer/EventSource';
import PointerEventHandler from './PointerEventHandler';


/**
 * @const
 * @type {Array.<string>}
 */
const POINTER_TYPES = [
	'',
	'unavailable',
	'touch',
	'pen',
	'mouse'
];

/**
 * @param {module:ol/pointer/PointerEventHandler} dispatcher Event handler.
 * @constructor
 * @extends {module:ol/pointer/EventSource}
 */
export default class MsSource extends EventSource {
	public pointerMap: { [point: string]: MSPointerEvent | any; };
	constructor(dispatcher: PointerEventHandler) {
		super(dispatcher, {
			MSPointerDown(e) {
				return this.msPointerDown(e);
			},
			MSPointerMove(e) {
				return this.msPointerMove(e);
			},
			MSPointerUp(e) {
				return this.msPointerUp(e);
			},
			MSPointerOut(e) {
				return this.msPointerOut(e);
			},
			MSPointerOver(e) {
				return this.msPointerOver(e);
			},
			MSPointerCancel(e) {
				return this.msPointerCancel(e);
			},
			MSGotPointerCapture(e) {
				return this.msGotPointerCapture(e);
			},
			MSLostPointerCapture(e) {
				return this.msLostPointerCapture(e);
			}
		});

		/**
		 * @const
		 * @type {!Object.<string, MSPointerEvent|Object>}
		 */
		this.pointerMap = dispatcher.pointerMap;
	}

	/**
	 * Remove this pointer from the list of active pointers.
	 * @param {number} pointerId Pointer identifier.
	 */
	public cleanup(pointerId: number) {
		delete this.pointerMap[pointerId.toString()];
	}


	/**
	 * Handler for `msPointerDown`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msPointerDown(inEvent: MSPointerEvent) {
		this.pointerMap[inEvent.pointerId.toString()] = inEvent;
		const e = this.prepareEvent_(inEvent);
		this.dispatcher.down(e, inEvent);
	}


	/**
	 * Handler for `msPointerMove`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msPointerMove(inEvent: MSPointerEvent) {
		const e = this.prepareEvent_(inEvent);
		this.dispatcher.move(e, inEvent);
	}


	/**
	 * Handler for `msPointerUp`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msPointerUp(inEvent: MSPointerEvent) {
		const e = this.prepareEvent_(inEvent);
		this.dispatcher.up(e, inEvent);
		this.cleanup(inEvent.pointerId);
	}


	/**
	 * Handler for `msPointerOut`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msPointerOut(inEvent: MSPointerEvent) {
		const e = this.prepareEvent_(inEvent);
		this.dispatcher.leaveOut(e, inEvent);
	}


	/**
	 * Handler for `msPointerOver`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msPointerOver(inEvent: MSPointerEvent) {
		const e = this.prepareEvent_(inEvent);
		this.dispatcher.enterOver(e, inEvent);
	}


	/**
	 * Handler for `msPointerCancel`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msPointerCancel(inEvent: MSPointerEvent) {
		const e = this.prepareEvent_(inEvent);
		this.dispatcher.cancel(e, inEvent);
		this.cleanup(inEvent.pointerId);
	}


	/**
	 * Handler for `msLostPointerCapture`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msLostPointerCapture(inEvent: MSPointerEvent) {
		const e = this.dispatcher.makeEvent('lostpointercapture', inEvent, inEvent);
		this.dispatcher.dispatchEvent(e);
	}


	/**
	 * Handler for `msGotPointerCapture`.
	 *
	 * @param {MSPointerEvent} inEvent The in event.
	 */
	public msGotPointerCapture(inEvent: MSPointerEvent) {
		const e = this.dispatcher.makeEvent('gotpointercapture', inEvent, inEvent);
		this.dispatcher.dispatchEvent(e);
	}

	/**
	 * Creates a copy of the original event that will be used
	 * for the fake pointer event.
	 *
	 * @private
	 * @param {MSPointerEvent} inEvent The in event.
	 * @return {Object} The copied event.
	 */
	private prepareEvent_(inEvent: MSPointerEvent) {
		if (typeof inEvent.pointerType === 'number') {
			const e = this.dispatcher.cloneEvent(inEvent, inEvent);
			e.pointerType = POINTER_TYPES[inEvent.pointerType];
			return e;
		} else {
			return inEvent;
		}
	}
}
