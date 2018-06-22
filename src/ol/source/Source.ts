/**
 * @module ol/source/Source
 */
import BaseObject from '../Object';
import { FrameState } from '../PluggableMap';
import { get as getProjection, ProjectionLike } from '../proj';
import Projection from '../proj/Projection';
import SourceState from '../source/State';


/**
 * A function that returns a string or an array of strings representing source
 * attributions.
 *
 * @typedef {function(module:ol/PluggableMap~FrameState): (string|Array.<string>)} Attribution
 */

export type Attribution = (state: FrameState) => string | string[];

/**
 * A type that can be used to provide attribution information for data sources.
 *
 * It represents either
 * * a simple string (e.g. `'© Acme Inc.'`)
 * * an array of simple strings (e.g. `['© Acme Inc.', '© Bacme Inc.']`)
 * * a function that returns a string or array of strings (`{@link module:ol/source/Source~Attribution}`)
 *
 * @typedef {string|Array.<string>|module:ol/source/Source~Attribution} AttributionLike
 */

export type AttributionLike = string | string[] | Attribution;

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions]
 * @property {module:ol/proj~ProjectionLike} projection
 * @property {module:ol/source/State} [state]
 * @property {boolean} [wrapX]
 */

export interface Options {
	attributions: AttributionLike;
	projection: ProjectionLike;
	state: SourceState;
	wrapX: boolean;
}

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for {@link module:ol/layer/Layer~Layer} sources.
 *
 * A generic `change` event is triggered when the state of the source changes.
 *
 * @constructor
 * @abstract
 * @extends {module:ol/Object}
 * @param {module:ol/source/Source~Options} options Source options.
 * @api
 */
export default abstract class Source extends BaseObject {
	private projection_: Projection;
	private attributions_: Attribution | null;
	private state_: SourceState;
	private wrapX_: boolean;
	constructor(options: Partial<Options>) {
		super();

		/**
		 * @private
		 * @type {module:ol/proj/Projection}
		 */
		this.projection_ = getProjection(options.projection)!;

		/**
		 * @private
		 * @type {?module:ol/source/Source~Attribution}
		 */
		this.attributions_ = this.adaptAttributions_(options.attributions);

		/**
		 * @private
		 * @type {module:ol/source/State}
		 */
		this.state_ = options.state !== undefined ?
			options.state : SourceState.READY;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.wrapX_ = options.wrapX !== undefined ? options.wrapX : false;

	}

	/**
	 * Turns the attributions option into an attributions function.
	 * @param {module:ol/source/Source~AttributionLike|undefined} attributionLike The attribution option.
	 * @return {?module:ol/source/Source~Attribution} An attribution function (or null).
	 */
	public adaptAttributions_(attributionLike: AttributionLike | undefined) {
		if (!attributionLike) {
			return null;
		}
		if (Array.isArray(attributionLike)) {
			return (_frameState: FrameState) => {
				return attributionLike;
			};
		}

		if (typeof attributionLike === 'function') {
			return attributionLike;
		}

		return (_frameState: FrameState) => {
			return [attributionLike];
		};
	}

	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {number} resolution Resolution.
	 * @param {number} rotation Rotation.
	 * @param {number} hitTolerance Hit tolerance in pixels.
	 * @param {Object.<string, boolean>} skippedFeatureUids Skipped feature uids.
	 * @param {function((module:ol/Feature|module:ol/render/Feature)): T} callback Feature callback.
	 * @return {T|undefined} Callback result.
	 * @template T
	 */
	public forEachFeatureAtCoordinate() { }


	/**
	 * Get the attribution function for the source.
	 * @return {?module:ol/source/Source~Attribution} Attribution function.
	 */
	public getAttributions() {
		return this.attributions_;
	}


	/**
	 * Get the projection of the source.
	 * @return {module:ol/proj/Projection} Projection.
	 * @api
	 */
	public getProjection() {
		return this.projection_;
	}


	/**
	 * @abstract
	 * @return {Array.<number>|undefined} Resolutions.
	 */
	public abstract getResolutions(): number[] | undefined | null;


	/**
	 * Get the state of the source, see {@link module:ol/source/State~State} for possible states.
	 * @return {module:ol/source/State} State.
	 * @api
	 */
	public getState() {
		return this.state_;
	}


	/**
	 * @return {boolean|undefined} Wrap X.
	 */
	public getWrapX() {
		return this.wrapX_;
	}


	/**
	 * Refreshes the source and finally dispatches a 'change' event.
	 * @api
	 */
	public refresh() {
		this.changed();
	}


	/**
	 * Set the attributions of the source.
	 * @param {module:ol/source/Source~AttributionLike|undefined} attributions Attributions.
	 *     Can be passed as `string`, `Array<string>`, `{@link module:ol/source/Source~Attribution}`,
	 *     or `undefined`.
	 * @api
	 */
	public setAttributions(attributions: AttributionLike | undefined) {
		this.attributions_ = this.adaptAttributions_(attributions);
		this.changed();
	}


	/**
	 * Set the state of the source.
	 * @param {module:ol/source/State} state State.
	 * @protected
	 */
	protected setState(state: SourceState) {
		this.state_ = state;
		this.changed();
	}
}
