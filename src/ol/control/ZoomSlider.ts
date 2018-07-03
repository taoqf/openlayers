/**
 * @module ol/control/ZoomSlider
 */
import Control from '../control/Control';
import { CLASS_CONTROL, CLASS_UNSELECTABLE } from '../css';
import { easeOut } from '../easing';
import { listen } from '../events';
import { stopPropagation } from '../events/Event';
import EventType from '../events/EventType';
import MapEvent from '../MapEvent';
import { clamp } from '../math';
import PluggableMap from '../PluggableMap';
import PointerEventType from '../pointer/EventType';
import PointerEvent from '../pointer/PointerEvent';
import PointerEventHandler from '../pointer/PointerEventHandler';
import { Size } from '../size';
import ViewHint from '../ViewHint';

/**
 * The enum for available directions.
 *
 * @enum {number}
 */
export enum Direction {
	HORIZONTAL = 1,
	VERTICAL = 0
}


/**
 * @typedef {Object} Options
 * @property {string} [className='ol-zoomslider'] CSS class name.
 * @property {number} [duration=200] Animation duration in milliseconds.
 * @property {function(module:ol/MapEvent)} [render] Function called when the control
 * should be re-rendered. This is called in a `requestAnimationFrame` callback.
 */

export interface Options {
	className: string;
	duration: number;
	render(e: MapEvent): void;
}

/**
 * @classdesc
 * A slider type of control for zooming.
 *
 * Example:
 *
 *     map.addControl(new ZoomSlider());
 *
 * @constructor
 * @extends {module:ol/control/Control}
 * @param {module:ol/control/ZoomSlider~Options=} opt_options Zoom slider options.
 * @api
 */
export default class ZoomSlider extends Control {
	private currentResolution_: number | undefined;
	private direction_: Direction;
	private dragging_: boolean | undefined;
	private heightLimit_: number;
	private widthLimit_: number;
	private previousX_: number | undefined;
	private previousY_: number | undefined;
	private thumbSize_: Size;
	private sliderInitialized_: boolean;
	private duration_: number;
	private dragger_: PointerEventHandler;
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options ? opt_options : {};

		const className = options.className !== undefined ? options.className : 'ol-zoomslider';
		const thumbElement = document.createElement('button');
		thumbElement.setAttribute('type', 'button');
		thumbElement.className = className + '-thumb ' + CLASS_UNSELECTABLE;
		const containerElement = document.createElement('div');
		containerElement.className = className + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL;
		containerElement.appendChild(thumbElement);
		/**
		 * @type {module:ol/pointer/PointerEventHandler}
		 * @private
		 */
		const dragger_ = new PointerEventHandler(containerElement);

		listen(dragger_, PointerEventType.POINTERDOWN,
			(e: any) => {
				return this.handleDraggerStart_(e);
			});
		listen(dragger_, PointerEventType.POINTERMOVE,
			(e: any) => {
				return this.handleDraggerDrag_(e);
			});
		listen(dragger_, PointerEventType.POINTERUP,
			(e: any) => {
				return this.handleDraggerEnd_(e);
			});

		listen(containerElement, EventType.CLICK, (e: any) => {
			return this.handleContainerClick_(e);
		});
		listen(thumbElement, EventType.CLICK, stopPropagation);

		super({
			element: containerElement,
			render: options.render || ((mapEvent) => {
				if (!mapEvent.frameState) {
					return;
				}
				if (!this.sliderInitialized_) {
					this.initSlider_();
				}
				const res = mapEvent.frameState.viewState.resolution;
				if (res !== this.currentResolution_) {
					this.currentResolution_ = res;
					this.setThumbPosition_(res);
				}
			})
		});

		/**
		 * Will hold the current resolution of the view.
		 *
		 * @type {number|undefined}
		 * @private
		 */
		this.currentResolution_ = undefined;

		/**
		 * The direction of the slider. Will be determined from actual display of the
		 * container and defaults to Direction.VERTICAL.
		 *
		 * @type {Direction}
		 * @private
		 */
		this.direction_ = Direction.VERTICAL;

		/**
		 * @type {number}
		 * @private
		 */
		this.heightLimit_ = 0;

		/**
		 * @type {number}
		 * @private
		 */
		this.widthLimit_ = 0;

		/**
		 * The calculated thumb size (border box plus margins).  Set when initSlider_
		 * is called.
		 * @type {module:ol/size~Size}
		 * @private
		 */
		this.thumbSize_ = null!;

		/**
		 * Whether the slider is initialized.
		 * @type {boolean}
		 * @private
		 */
		this.sliderInitialized_ = false;

		/**
		 * @type {number}
		 * @private
		 */
		this.duration_ = options.duration !== undefined ? options.duration : 200;
		this.dragger_ = dragger_;
	}


	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		this.dragger_.dispose();
		super.disposeInternal();
	}

	/**
	 * @inheritDoc
	 */
	public setMap(map: PluggableMap) {
		super.setMap(map);
		if (map) {
			map.render();
		}
	}


	/**
	 * Initializes the slider element. This will determine and set this controls
	 * direction_ and also constrain the dragging of the thumb to always be within
	 * the bounds of the container.
	 *
	 * @private
	 */
	private initSlider_() {
		const container = this.element;
		const containerSize = {
			height: container.offsetHeight,
			width: container.offsetWidth
		};

		const thumb = container.firstElementChild as HTMLElement;
		const computedStyle = getComputedStyle(thumb);
		const thumbWidth = thumb.offsetWidth +
			parseFloat(computedStyle.marginRight!) +
			parseFloat(computedStyle.marginLeft!);
		const thumbHeight = thumb.offsetHeight +
			parseFloat(computedStyle.marginTop!) +
			parseFloat(computedStyle.marginBottom!);
		this.thumbSize_ = [thumbWidth, thumbHeight];

		if (containerSize.width > containerSize.height) {
			this.direction_ = Direction.HORIZONTAL;
			this.widthLimit_ = containerSize.width - thumbWidth;
		} else {
			this.direction_ = Direction.VERTICAL;
			this.heightLimit_ = containerSize.height - thumbHeight;
		}
		this.sliderInitialized_ = true;
	}

	/**
	 * @param {Event} event The browser event to handle.
	 * @private
	 */
	private handleContainerClick_(event: MouseEvent) {
		const view = this.getMap().getView();

		const relativePosition = this.getRelativePosition_(
			event.offsetX - this.thumbSize_[0] / 2,
			event.offsetY - this.thumbSize_[1] / 2);

		const resolution = this.getResolutionForPosition_(relativePosition);

		view.animate({
			duration: this.duration_,
			easing: easeOut,
			resolution: view.constrainResolution(resolution)
		});
	}


	/**
	 * Handle dragger start events.
	 * @param {module:ol/pointer/PointerEvent} event The drag event.
	 * @private
	 */
	private handleDraggerStart_(event: PointerEvent) {
		if (!this.dragging_ && event.originalEvent.target === this.element.firstElementChild) {
			this.getMap().getView().setHint(ViewHint.INTERACTING, 1);
			this.previousX_ = event.clientX;
			this.previousY_ = event.clientY;
			this.dragging_ = true;
		}
	}


	/**
	 * Handle dragger drag events.
	 *
	 * @param {module:ol/pointer/PointerEvent|Event} event The drag event.
	 * @private
	 */
	private handleDraggerDrag_(event: PointerEvent | Event) {
		if (this.dragging_) {
			const element = this.element.firstElementChild as HTMLElement;
			const deltaX = (event as PointerEvent).clientX! - this.previousX_! + parseInt(element.style.left!, 10);
			const deltaY = (event as PointerEvent).clientY! - this.previousY_! + parseInt(element.style.top!, 10);
			const relativePosition = this.getRelativePosition_(deltaX, deltaY);
			this.currentResolution_ = this.getResolutionForPosition_(relativePosition);
			this.getMap().getView().setResolution(this.currentResolution_);
			this.setThumbPosition_(this.currentResolution_);
			this.previousX_ = (event as PointerEvent).clientX;
			this.previousY_ = (event as PointerEvent).clientY;
		}
	}


	/**
	 * Handle dragger end events.
	 * @param {module:ol/pointer/PointerEvent|Event} event The drag event.
	 * @private
	 */
	private handleDraggerEnd_(_event: PointerEvent | Event) {
		if (this.dragging_) {
			const view = this.getMap().getView();
			view.setHint(ViewHint.INTERACTING, -1);

			view.animate({
				duration: this.duration_,
				easing: easeOut,
				resolution: view.constrainResolution(this.currentResolution_)
			});

			this.dragging_ = false;
			this.previousX_ = undefined;
			this.previousY_ = undefined;
		}
	}


	/**
	 * Positions the thumb inside its container according to the given resolution.
	 *
	 * @param {number} res The res.
	 * @private
	 */
	private setThumbPosition_(res: number) {
		const position = this.getPositionForResolution_(res);
		const thumb = this.element.firstElementChild as HTMLElement;

		if (this.direction_ === Direction.HORIZONTAL) {
			thumb.style.left = this.widthLimit_ * position + 'px';
		} else {
			thumb.style.top = this.heightLimit_ * position + 'px';
		}
	}


	/**
	 * Calculates the relative position of the thumb given x and y offsets.  The
	 * relative position scales from 0 to 1.  The x and y offsets are assumed to be
	 * in pixel units within the dragger limits.
	 *
	 * @param {number} x Pixel position relative to the left of the slider.
	 * @param {number} y Pixel position relative to the top of the slider.
	 * @return {number} The relative position of the thumb.
	 * @private
	 */
	private getRelativePosition_(x: number, y: number) {
		let amount;
		if (this.direction_ === Direction.HORIZONTAL) {
			amount = x / this.widthLimit_;
		} else {
			amount = y / this.heightLimit_;
		}
		return clamp(amount, 0, 1);
	}


	/**
	 * Calculates the corresponding resolution of the thumb given its relative
	 * position (where 0 is the minimum and 1 is the maximum).
	 *
	 * @param {number} position The relative position of the thumb.
	 * @return {number} The corresponding resolution.
	 * @private
	 */
	private getResolutionForPosition_(position: number) {
		const fn = this.getMap().getView().getResolutionForValueFunction();
		return fn(1 - position);
	}


	/**
	 * Determines the relative position of the slider for the given resolution.  A
	 * relative position of 0 corresponds to the minimum view resolution.  A
	 * relative position of 1 corresponds to the maximum view resolution.
	 *
	 * @param {number} res The resolution.
	 * @return {number} The relative position value (between 0 and 1).
	 * @private
	 */
	private getPositionForResolution_(res: number) {
		const fn = this.getMap().getView().getValueForResolutionFunction();
		return 1 - fn(res);
	}
}
