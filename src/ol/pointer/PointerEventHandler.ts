/**
 * @module ol/pointer/PointerEventHandler
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

import { listen, unlisten } from '../events';
// import Event from '../events/Event';
import EventTarget from '../events/EventTarget';
import { MSPOINTER, POINTER, TOUCH } from '../has';
import PointerEventType from '../pointer/EventType';
import MouseSource from '../pointer/MouseSource';
import MsSource from '../pointer/MsSource';
import NativeSource from '../pointer/NativeSource';
import PointerEvent from '../pointer/PointerEvent';
import TouchSource from '../pointer/TouchSource';
import EventSource from './EventSource';


/**
 * Properties to copy when cloning an event, with default values.
 * @type {Array.<Array>}
 */
const CLONE_PROPS = [
	// MouseEvent
	['bubbles', false],
	['cancelable', false],
	['view', null],
	['detail', null],
	['screenX', 0],
	['screenY', 0],
	['clientX', 0],
	['clientY', 0],
	['ctrlKey', false],
	['altKey', false],
	['shiftKey', false],
	['metaKey', false],
	['button', 0],
	['relatedTarget', null],
	// DOM Level 3
	['buttons', 0],
	// PointerEvent
	['pointerId', 0],
	['width', 0],
	['height', 0],
	['pressure', 0],
	['tiltX', 0],
	['tiltY', 0],
	['pointerType', ''],
	['hwTimestamp', 0],
	['isPrimary', false],
	// event instance
	['type', ''],
	['target', null],
	['currentTarget', null],
	['which', 0]
];

/**
 * @constructor
 * @extends {module:ol/events/EventTarget}
 * @param {Element|HTMLDocument} element Viewport element.
 */
export default class PointerEventHandler extends EventTarget {
	public pointerMap: { [point: string]: string | Event };
	private eventMap_: { [event: string]: (e: Event) => void };
	private element_: HTMLElement | HTMLDocument;
	private eventSourceList_: EventSource[];
	constructor(element: HTMLElement | HTMLDocument) {
		super();

		/**
		 * @const
		 * @private
		 * @type {Element|HTMLDocument}
		 */
		this.element_ = element;

		/**
		 * @const
		 * @type {!Object.<string, Event|Object>}
		 */
		this.pointerMap = {};

		/**
		 * @type {Object.<string, function(Event)>}
		 * @private
		 */
		this.eventMap_ = {};

		/**
		 * @type {Array.<module:ol/pointer/EventSource>}
		 * @private
		 */
		this.eventSourceList_ = [];

		this.registerSources();
	}

	/**
	 * Set up the event sources (mouse, touch and native pointers)
	 * that generate pointer events.
	 */
	public registerSources() {
		if (POINTER) {
			this.registerSource('native', new NativeSource(this));
		} else if (MSPOINTER) {
			this.registerSource('ms', new MsSource(this));
		} else {
			const mouseSource = new MouseSource(this);
			this.registerSource('mouse', mouseSource);

			if (TOUCH) {
				this.registerSource('touch', new TouchSource(this, mouseSource));
			}
		}

		// register events on the viewport element
		this.register_();
	}


	/**
	 * Add a new event source that will generate pointer events.
	 *
	 * @param {string} name A name for the event source
	 * @param {module:ol/pointer/EventSource} source The source event.
	 */
	public registerSource(_name: string, source: EventSource) {
		const s = source;	// ? copy source
		const newEvents = s.getEvents();

		if (newEvents) {
			newEvents.forEach((e) => {
				const handler = s.getHandlerForEvent(e);

				if (handler) {
					this.eventMap_[e] = handler.bind(s);
				}
			});
			this.eventSourceList_.push(s);
		}
	}

	/**
	 * Returns a snapshot of inEvent, with writable properties.
	 *
	 * @param {Event} event Browser event.
	 * @param {Event|Touch} inEvent An event that contains
	 *    properties to copy.
	 * @return {Object} An object containing shallow copies of
	 *    `inEvent`'s properties.
	 */
	public cloneEvent(event: Event, inEvent: Event | Touch) {
		const eventCopy = {} as any;
		for (let i = 0, ii = CLONE_PROPS.length; i < ii; i++) {
			const p = CLONE_PROPS[i][0] as string;
			eventCopy[p] = (event as any)[p] || (inEvent as any)[p] || CLONE_PROPS[i][1];
		}

		return eventCopy;
	}

	// EVENTS

	/**
	 * Triggers a 'pointerdown' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public down(data: any, event: Event) {
		this.fireEvent(PointerEventType.POINTERDOWN, data, event);
	}


	/**
	 * Triggers a 'pointermove' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public move(data: any, event: Event) {
		this.fireEvent(PointerEventType.POINTERMOVE, data, event);
	}


	/**
	 * Triggers a 'pointerup' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public up(data: any, event: Event) {
		this.fireEvent(PointerEventType.POINTERUP, data, event);
	}


	/**
	 * Triggers a 'pointerenter' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public enter(data: any, event: Event) {
		data.bubbles = false;
		this.fireEvent(PointerEventType.POINTERENTER, data, event);
	}


	/**
	 * Triggers a 'pointerleave' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public leave(data: any, event: Event) {
		data.bubbles = false;
		this.fireEvent(PointerEventType.POINTERLEAVE, data, event);
	}


	/**
	 * Triggers a 'pointerover' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public over(data: any, event: Event) {
		data.bubbles = true;
		this.fireEvent(PointerEventType.POINTEROVER, data, event);
	}


	/**
	 * Triggers a 'pointerout' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public out(data: any, event: Event) {
		data.bubbles = true;
		this.fireEvent(PointerEventType.POINTEROUT, data, event);
	}


	/**
	 * Triggers a 'pointercancel' event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public cancel(data: any, event: Event) {
		this.fireEvent(PointerEventType.POINTERCANCEL, data, event);
	}


	/**
	 * Triggers a combination of 'pointerout' and 'pointerleave' events.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public leaveOut(data: any, event: Event) {
		this.out(data, event);
		if (!this.contains_(data.target, data.relatedTarget)) {
			this.leave(data, event);
		}
	}


	/**
	 * Triggers a combination of 'pointerover' and 'pointerevents' events.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public enterOver(data: any, event: Event) {
		this.over(data, event);
		if (!this.contains_(data.target, data.relatedTarget)) {
			this.enter(data, event);
		}
	}

	// EVENT CREATION AND TRACKING
	/**
	 * Creates a new Event of type `inType`, based on the information in
	 * `data`.
	 *
	 * @param {string} inType A string representing the type of event to create.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 * @return {module:ol/pointer/PointerEvent} A PointerEvent of type `inType`.
	 */
	public makeEvent(inType: string, data: any, event: Event) {
		return new PointerEvent(inType, event, data);
	}


	/**
	 * Make and dispatch an event in one call.
	 * @param {string} inType A string representing the type of event.
	 * @param {Object} data Pointer event data.
	 * @param {Event} event The event.
	 */
	public fireEvent(inType: string, data: any, event: Event) {
		const e = this.makeEvent(inType, data, event);
		this.dispatchEvent(e);
	}


	/**
	 * Creates a pointer event from a native pointer event
	 * and dispatches this event.
	 * @param {Event} event A platform event with a target.
	 */
	public fireNativeEvent(event: Event) {
		const e = this.makeEvent(event.type, event, event);
		this.dispatchEvent(e);
	}


	/**
	 * Wrap a native mouse event into a pointer event.
	 * This proxy method is required for the legacy IE support.
	 * @param {string} eventType The pointer event type.
	 * @param {Event} event The event.
	 * @return {module:ol/pointer/PointerEvent} The wrapped event.
	 */
	public wrapMouseEvent(eventType: string, event: Event) {
		const pointerEvent = this.makeEvent(
			eventType, MouseSource.prepareEvent(event, this), event);
		return pointerEvent;
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		this.unregister_();
		EventTarget.prototype.disposeInternal.call(this);
	}


	/**
	 * Set up the events for all registered event sources.
	 * @private
	 */
	private register_() {
		const l = this.eventSourceList_.length;
		for (let i = 0; i < l; i++) {
			const eventSource = this.eventSourceList_[i];
			this.addEvents_(eventSource.getEvents());
		}
	}


	/**
	 * Remove all registered events.
	 * @private
	 */
	private unregister_() {
		const l = this.eventSourceList_.length;
		for (let i = 0; i < l; i++) {
			const eventSource = this.eventSourceList_[i];
			this.removeEvents_(eventSource.getEvents());
		}
	}


	/**
	 * Calls the right handler for a new event.
	 * @private
	 * @param {Event} inEvent Browser event.
	 */
	private eventHandler_(inEvent: Event) {
		const type = inEvent.type;
		const handler = this.eventMap_[type];
		if (handler) {
			handler(inEvent);
		}
	}


	/**
	 * Setup listeners for the given events.
	 * @private
	 * @param {Array.<string>} events List of events.
	 */
	private addEvents_(events: string[]) {
		events.forEach((eventName) => {
			listen(this.element_, eventName, this.eventHandler_ as any, this);
		});
	}


	/**
	 * Unregister listeners for the given events.
	 * @private
	 * @param {Array.<string>} events List of events.
	 */
	private removeEvents_(events: string[]) {
		events.forEach((e) => {
			unlisten(this.element_, e, this.eventHandler_, this);
		});
	}

	/**
	 * @private
	 * @param {Element} container The container element.
	 * @param {Element} contained The contained element.
	 * @return {boolean} Returns true if the container element
	 *   contains the other element.
	 */
	private contains_(container: Element, contained: Element) {
		if (!container || !contained) {
			return false;
		}
		return container.contains(contained);
	}
}
