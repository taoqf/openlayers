/**
 * @module ol/control/util
 */
import Collection from '../Collection';
import Attribution, { Options as AttributionOptions } from './Attribution';
import Rotate, { Options as RotateOptions } from './Rotate';
import Zoom, { Options as ZoomOptions } from './Zoom';


/**
 * @typedef {Object} DefaultsOptions
 * @property {boolean} [attribution=true] Include
 * {@link module:ol/control/Attribution~Attribution}.
 * @property {module:ol/control/Attribution~Options} [attributionOptions]
 * Options for {@link module:ol/control/Attribution~Attribution}.
 * @property {boolean} [rotate=true] Include
 * {@link module:ol/control/Rotate~Rotate}.
 * @property {module:ol/control/Rotate~Options} [rotateOptions] Options
 * for {@link module:ol/control/Rotate~Rotate}.
 * @property {boolean} [zoom] Include {@link module:ol/control/Zoom~Zoom}.
 * @property {module:ol/control/Zoom~Options} [zoomOptions] Options for
 * {@link module:ol/control/Zoom~Zoom}.
 * @api
 */

export interface DefaultsOptions {
	attribution: boolean;
	attributionOptions: AttributionOptions;
	rotate: boolean;
	rotateOptions: RotateOptions;
	zoom: boolean;
	zoomOptions: ZoomOptions;
}

/**
 * Set of controls included in maps by default. Unless configured otherwise,
 * this returns a collection containing an instance of each of the following
 * controls:
 * * {@link module:ol/control/Zoom~Zoom}
 * * {@link module:ol/control/Rotate~Rotate}
 * * {@link module:ol/control/Attribution~Attribution}
 *
 * @param {module:ol/control/util~DefaultsOptions=} opt_options
 * Defaults options.
 * @return {module:ol/Collection.<module:ol/control/Control>}
 * Controls.
 * @function module:ol/control.defaults
 * @api
 */
export function defaults(opt_options?: Partial<DefaultsOptions>) {
	const options = opt_options ? opt_options : {};

	const controls = new Collection();

	const zoomControl = options.zoom !== undefined ? options.zoom : true;
	if (zoomControl) {
		controls.push(new Zoom(options.zoomOptions));
	}

	const rotateControl = options.rotate !== undefined ? options.rotate : true;
	if (rotateControl) {
		controls.push(new Rotate(options.rotateOptions));
	}

	const attributionControl = options.attribution !== undefined ?
		options.attribution : true;
	if (attributionControl) {
		controls.push(new Attribution(options.attributionOptions!));
	}

	return controls;
}
