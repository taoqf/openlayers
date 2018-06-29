/**
 * @module ol/control/MousePosition
 */

import Control from '../control/Control';
import { CoordinateFormat } from '../coordinate';
import { listen } from '../events';
import EventType from '../events/EventType';
import { Pixel } from '../index';
import MapEvent from '../MapEvent';
import { getChangeEventType } from '../Object';
import PluggableMap from '../PluggableMap';
import { get as getProjection, getTransformFromProjections, identityTransform, ProjectionLike, TransformFunction } from '../proj';
import Projection from '../proj/Projection';

/**
 * @type {string}
 */
const PROJECTION = 'projection';

/**
 * @type {string}
 */
const COORDINATE_FORMAT = 'coordinateFormat';


/**
 * @typedef {Object} Options
 * @property {string} [className='ol-mouse-position'] CSS class name.
 * @property {module:ol/coordinate~CoordinateFormat} [coordinateFormat] Coordinate format.
 * @property {module:ol/proj~ProjectionLike} projection Projection.
 * @property {function(module:ol/MapEvent)} [render] Function called when the
 * control should be re-rendered. This is called in a `requestAnimationFrame`
 * callback.
 * @property {Element|string} [target] Specify a target if you want the
 * control to be rendered outside of the map's viewport.
 * @property {string} [undefinedHTML='&nbsp;'] Markup to show when coordinates are not
 * available (e.g. when the pointer leaves the map viewport).  By default, the last position
 * will be replaced with `'&nbsp;'` when the pointer leaves the viewport.  To
 * retain the last rendered position, set this option to something falsey (like an empty
 * string `''`).
 */

export interface Options {
	className: string;
	coordinateFormat: CoordinateFormat;
	projection: ProjectionLike;
	target: Element | string;
	undefinedHTML: string;
	render(e: MapEvent): void;
}

/**
 * @classdesc
 * A control to show the 2D coordinates of the mouse cursor. By default, these
 * are in the view projection, but can be in any supported projection.
 * By default the control is shown in the top right corner of the map, but this
 * can be changed by using the css selector `.ol-mouse-position`.
 *
 * @constructor
 * @extends {module:ol/control/Control}
 * @param {module:ol/control/MousePosition~Options=} opt_options Mouse position
 *     options.
 * @api
 */
export default class MousePosition extends Control {
	private undefinedHTML_: string;
	private renderOnMouseOut_: boolean;
	private renderedHTML_: string;
	private mapProjection_: Projection | null;
	private transform_: TransformFunction | null;
	private lastMouseMovePixel_: Pixel | null;
	constructor(opt_options?: Options) {
		const options = opt_options ? opt_options : {} as Options;

		const element = document.createElement('DIV');
		element.className = options.className !== undefined ? options.className : 'ol-mouse-position';

		super({
			element,
			render: options.render || ((mapEvent: MapEvent) => {
				const frameState = mapEvent.frameState;
				if (!frameState) {
					this.mapProjection_ = null;
				} else {
					if (this.mapProjection_ !== frameState.viewState.projection) {
						this.mapProjection_ = frameState.viewState.projection;
						this.transform_ = null;
					}
				}
				this.updateHTML_(this.lastMouseMovePixel_!);
			}),
			target: options.target
		});

		listen(this,
			getChangeEventType(PROJECTION),
			this.handleProjectionChanged_, this);

		if (options.coordinateFormat) {
			this.setCoordinateFormat(options.coordinateFormat);
		}
		if (options.projection) {
			this.setProjection(options.projection);
		}

		/**
		 * @private
		 * @type {string}
		 */
		this.undefinedHTML_ = 'undefinedHTML' in options ? options.undefinedHTML : '&nbsp;';

		/**
		 * @private
		 * @type {boolean}
		 */
		this.renderOnMouseOut_ = !!this.undefinedHTML_;

		/**
		 * @private
		 * @type {string}
		 */
		this.renderedHTML_ = element.innerHTML;

		/**
		 * @private
		 * @type {module:ol/proj/Projection}
		 */
		this.mapProjection_ = null;

		/**
		 * @private
		 * @type {?module:ol/proj~TransformFunction}
		 */
		this.transform_ = null;

		/**
		 * @private
		 * @type {module:ol~Pixel}
		 */
		this.lastMouseMovePixel_ = null;

	}

	/**
	 * Return the coordinate format type used to render the current position or
	 * undefined.
	 * @return {module:ol/coordinate~CoordinateFormat|undefined} The format to render the current
	 *     position in.
	 * @observable
	 * @api
	 */
	public getCoordinateFormat() {
		/** @type {module:ol/coordinate~CoordinateFormat|undefined} */
		return this.get(COORDINATE_FORMAT) as CoordinateFormat;
	}

	/**
	 * Return the projection that is used to report the mouse position.
	 * @return {module:ol/proj/Projection|undefined} The projection to report mouse
	 *     position in.
	 * @observable
	 * @api
	 */
	public getProjection() {
		return (
		/** @type {module:ol/proj/Projection|undefined} */ (this.get(PROJECTION))
		);
	}


	/**
	 * @param {Event} event Browser event.
	 * @protected
	 */
	public handleMouseMove(event: Event) {
		const map = this.getMap();
		this.lastMouseMovePixel_ = map.getEventPixel(event);
		this.updateHTML_(this.lastMouseMovePixel_);
	}


	/**
	 * @param {Event} event Browser event.
	 * @protected
	 */
	public handleMouseOut(_event: Event) {
		this.updateHTML_(null!);
		this.lastMouseMovePixel_ = null;
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public setMap(map: PluggableMap) {
		super.setMap(map);
		if (map) {
			const viewport = map.getViewport();
			this.listenerKeys.push(
				listen(viewport, EventType.MOUSEMOVE, this.handleMouseMove, this)!
			);
			if (this.renderOnMouseOut_) {
				this.listenerKeys.push(
					listen(viewport, EventType.MOUSEOUT, this.handleMouseOut, this)!
				);
			}
		}
	}

	/**
	 * Set the coordinate format type used to render the current position.
	 * @param {module:ol/coordinate~CoordinateFormat} format The format to render the current
	 *     position in.
	 * @observable
	 * @api
	 */
	public setCoordinateFormat(format: CoordinateFormat) {
		this.set(COORDINATE_FORMAT, format);
	}


	/**
	 * Set the projection that is used to report the mouse position.
	 * @param {module:ol/proj~ProjectionLike} projection The projection to report mouse
	 *     position in.
	 * @observable
	 * @api
	 */
	public setProjection(projection: ProjectionLike) {
		this.set(PROJECTION, getProjection(projection));
	}


	/**
	 * @param {?module:ol~Pixel} pixel Pixel.
	 * @private
	 */
	public updateHTML_(pixel: Pixel) {
		let html = this.undefinedHTML_;
		if (pixel && this.mapProjection_) {
			if (!this.transform_) {
				const projection = this.getProjection();
				if (projection) {
					this.transform_ = getTransformFromProjections(
						this.mapProjection_, projection);
				} else {
					this.transform_ = identityTransform;
				}
			}
			const map = this.getMap();
			const coordinate = map.getCoordinateFromPixel(pixel);
			if (coordinate) {
				this.transform_(coordinate, coordinate);
				const coordinateFormat = this.getCoordinateFormat();
				if (coordinateFormat) {
					html = coordinateFormat(coordinate);
				} else {
					html = coordinate.toString();
				}
			}
		}
		if (!this.renderedHTML_ || html !== this.renderedHTML_) {
			this.element.innerHTML = html;
			this.renderedHTML_ = html;
		}
	}
	private handleProjectionChanged_() {
		this.transform_ = null;
	}
}
