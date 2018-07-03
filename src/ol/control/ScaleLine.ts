/**
 * @module ol/control/ScaleLine
 */
import { assert } from '../asserts';
import Control from '../control/Control';
import { CLASS_UNSELECTABLE } from '../css';
import { listen } from '../events';
import MapEvent from '../MapEvent';
import { getChangeEventType } from '../Object';
import { getPointResolution, METERS_PER_UNIT } from '../proj';
import ProjUnits from '../proj/Units';
import { State } from '../View';


/**
 * @type {string}
 */
const UNITS_PROP = 'units';

/**
 * Units for the scale line. Supported values are `'degrees'`, `'imperial'`,
 * `'nautical'`, `'metric'`, `'us'`.
 * @enum {string}
 */
export enum Units {
	DEGREES = 'degrees',
	IMPERIAL = 'imperial',
	NAUTICAL = 'nautical',
	METRIC = 'metric',
	US = 'us'
}


/**
 * @const
 * @type {Array.<number>}
 */
const LEADING_DIGITS = [1, 2, 5];


/**
 * @typedef {Object} Options
 * @property {string} [className='ol-scale-line'] CSS Class name.
 * @property {number} [minWidth=64] Minimum width in pixels.
 * @property {function(module:ol/MapEvent)} [render] Function called when the control
 * should be re-rendered. This is called in a `requestAnimationFrame` callback.
 * @property {Element|string} [target] Specify a target if you want the control
 * to be rendered outside of the map's viewport.
 * @property {module:ol/control/ScaleLine~Units|string} [units='metric'] Units.
 */

export interface Options {
	className: string;
	minWidth: number;
	target: Element | string;
	units: Units | string;
	render(e: MapEvent): void;
}

/**
 * @classdesc
 * A control displaying rough y-axis distances, calculated for the center of the
 * viewport. For conformal projections (e.g. EPSG:3857, the default view
 * projection in OpenLayers), the scale is valid for all directions.
 * No scale line will be shown when the y-axis distance of a pixel at the
 * viewport center cannot be calculated in the view projection.
 * By default the scale line will show in the bottom left portion of the map,
 * but this can be changed by using the css selector `.ol-scale-line`.
 *
 * @constructor
 * @extends {module:ol/control/Control}
 * @param {module:ol/control/ScaleLine~Options=} opt_options Scale line options.
 * @api
 */
export default class ScaleLine extends Control {
	private innerElement_: HTMLDivElement;
	private element_: HTMLDivElement;
	private viewState_: State;
	private minWidth_: number;
	private renderedVisible_: boolean;
	private renderedWidth_: number | undefined;
	private renderedHTML_: string;
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options ? opt_options : {};

		const className = options.className !== undefined ? options.className : 'ol-scale-line';

		/**
		 * @private
		 * @type {Element}
		 */
		const innerElement_ = document.createElement('div');
		innerElement_.className = className + '-inner';

		/**
		 * @private
		 * @type {Element}
		 */
		const element_ = document.createElement('div');
		element_.className = className + ' ' + CLASS_UNSELECTABLE;
		element_.appendChild(innerElement_);

		super({
			element: element_,
			render: options.render || ((mapEvent: MapEvent) => {
				const frameState = mapEvent.frameState;
				if (!frameState) {
					this.viewState_ = null!;
				} else {
					this.viewState_ = frameState.viewState;
				}
				this.updateElement_();
			}),
			target: options.target
		});
		this.element_ = element_;

		/**
		 * @private
		 * @type {?module:ol/View~State}
		 */
		this.viewState_ = null!;

		/**
		 * @private
		 * @type {number}
		 */
		this.minWidth_ = options.minWidth !== undefined ? options.minWidth : 64;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.renderedVisible_ = false;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.renderedWidth_ = undefined;

		this.innerElement_ = innerElement_;
		/**
		 * @private
		 * @type {string}
		 */
		this.renderedHTML_ = '';

		listen(
			this, getChangeEventType(UNITS_PROP),
			this.handleUnitsChanged_, this);

		this.setUnits(/** @type {module:ol/control/ScaleLine~Units} */(options.units) ||
			Units.METRIC);

	}

	/**
	 * Return the units to use in the scale line.
	 * @return {module:ol/control/ScaleLine~Units|undefined} The units
	 * to use in the scale line.
	 * @observable
	 * @api
	 */
	public getUnits() {
		return (
	/** @type {module:ol/control/ScaleLine~Units|undefined} */ (this.get(UNITS_PROP))
		);
	}

	/**
	 * Set the units to use in the scale line.
	 * @param {module:ol/control/ScaleLine~Units} units The units to use in the scale line.
	 * @observable
	 * @api
	 */
	public setUnits(units: Units | string) {
		this.set(UNITS_PROP, units);
	}


	/**
	 * @private
	 */
	private updateElement_() {
		const viewState = this.viewState_;

		if (!viewState) {
			if (this.renderedVisible_) {
				this.element_.style.display = 'none';
				this.renderedVisible_ = false;
			}
			return;
		}

		const center = viewState.center;
		const projection = viewState.projection;
		const units = this.getUnits();
		const pointResolutionUnits = units === Units.DEGREES ?
			ProjUnits.DEGREES :
			ProjUnits.METERS;
		let pointResolution =
			getPointResolution(projection, viewState.resolution, center, pointResolutionUnits);
		if (projection.getUnits() !== ProjUnits.DEGREES && projection.getMetersPerUnit()
			&& pointResolutionUnits === ProjUnits.METERS) {
			pointResolution *= projection.getMetersPerUnit();
		}

		let nominalCount = this.minWidth_ * pointResolution;
		let suffix = '';
		if (units === Units.DEGREES) {
			const metersPerDegree = METERS_PER_UNIT[ProjUnits.DEGREES];
			if (projection.getUnits() === ProjUnits.DEGREES) {
				nominalCount *= metersPerDegree;
			} else {
				pointResolution /= metersPerDegree;
			}
			if (nominalCount < metersPerDegree / 60) {
				suffix = '\u2033'; // seconds
				pointResolution *= 3600;
			} else if (nominalCount < metersPerDegree) {
				suffix = '\u2032'; // minutes
				pointResolution *= 60;
			} else {
				suffix = '\u00b0'; // degrees
			}
		} else if (units === Units.IMPERIAL) {
			if (nominalCount < 0.9144) {
				suffix = 'in';
				pointResolution /= 0.0254;
			} else if (nominalCount < 1609.344) {
				suffix = 'ft';
				pointResolution /= 0.3048;
			} else {
				suffix = 'mi';
				pointResolution /= 1609.344;
			}
		} else if (units === Units.NAUTICAL) {
			pointResolution /= 1852;
			suffix = 'nm';
		} else if (units === Units.METRIC) {
			if (nominalCount < 0.001) {
				suffix = 'μm';
				pointResolution *= 1000000;
			} else if (nominalCount < 1) {
				suffix = 'mm';
				pointResolution *= 1000;
			} else if (nominalCount < 1000) {
				suffix = 'm';
			} else {
				suffix = 'km';
				pointResolution /= 1000;
			}
		} else if (units === Units.US) {
			if (nominalCount < 0.9144) {
				suffix = 'in';
				pointResolution *= 39.37;
			} else if (nominalCount < 1609.344) {
				suffix = 'ft';
				pointResolution /= 0.30480061;
			} else {
				suffix = 'mi';
				pointResolution /= 1609.3472;
			}
		} else {
			assert(false, 33); // Invalid units
		}

		let i = 3 * Math.floor(
			Math.log(this.minWidth_ * pointResolution) / Math.log(10));
		let count;
		let width;
		while (true) {
			count = LEADING_DIGITS[((i % 3) + 3) % 3] *
				Math.pow(10, Math.floor(i / 3));
			width = Math.round(count / pointResolution);
			if (isNaN(width)) {
				this.element_.style.display = 'none';
				this.renderedVisible_ = false;
				return;
			} else if (width >= this.minWidth_) {
				break;
			}
			++i;
		}

		const html = count + ' ' + suffix;
		if (this.renderedHTML_ !== html) {
			this.innerElement_.innerHTML = html;
			this.renderedHTML_ = html;
		}

		if (this.renderedWidth_ !== width) {
			this.innerElement_.style.width = width + 'px';
			this.renderedWidth_ = width;
		}

		if (!this.renderedVisible_) {
			this.element_.style.display = '';
			this.renderedVisible_ = true;
		}
	}

	/**
	 * @private
	 */
	private handleUnitsChanged_() {
		this.updateElement_();
	}
}
