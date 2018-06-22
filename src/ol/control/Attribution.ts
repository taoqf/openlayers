/**
 * @module ol/control/Attribution
 */
import { equals } from '../array';
import Control from '../control/Control';
import { CLASS_COLLAPSED, CLASS_CONTROL, CLASS_UNSELECTABLE } from '../css';
import { removeChildren, replaceNode } from '../dom';
import { listen } from '../events';
import EventType from '../events/EventType';
import { visibleAtResolution } from '../layer/Layer';
import MapEvent from '../MapEvent';
import { FrameState } from '../PluggableMap';


/**
 * @typedef {Object} Options
 * @property {string} [className='ol-attribution'] CSS class name.
 * @property {Element|string} [target] Specify a target if you
 * want the control to be rendered outside of the map's
 * viewport.
 * @property {boolean} [collapsible=true] Specify if attributions can
 * be collapsed. If you use an OSM source, should be set to `false` — see
 * {@link https://www.openstreetmap.org/copyright OSM Copyright} —
 * @property {boolean} [collapsed=true] Specify if attributions should
 * be collapsed at startup.
 * @property {string} [tipLabel='Attributions'] Text label to use for the button tip.
 * @property {string} [label='i'] Text label to use for the
 * collapsed attributions button.
 * Instead of text, also an element (e.g. a `span` element) can be used.
 * @property {string|Element} [collapseLabel='»'] Text label to use
 * for the expanded attributions button.
 * Instead of text, also an element (e.g. a `span` element) can be used.
 * @property {function(module:ol/MapEvent)} [render] Function called when
 * the control should be re-rendered. This is called in a `requestAnimationFrame`
 * callback.
 */

export interface Options {
	className?: string;
	target: HTMLElement | string;
	collapsible?: boolean;
	collapsed?: boolean;
	tipLabel?: string;
	label?: string;
	collapseLabel?: HTMLElement | string;
	render(e: MapEvent): void;
}

/**
 * @classdesc
 * Control to show all the attributions associated with the layer sources
 * in the map. This control is one of the default controls included in maps.
 * By default it will show in the bottom right portion of the map, but this can
 * be changed by using a css selector for `.ol-attribution`.
 * @api
 */
export default class Attribution extends Control {
	/**
	 * @private
	 * @type {Element}
	 */
	private ulElement: HTMLUListElement;
	/**
	 * @private
	 * @type {boolean}
	 */
	private collapsed: boolean;
	/**
	 * @private
	 * @type {boolean}
	 */
	private collapsible: boolean;
	/**
	 * @private
	 * @type {Element}
	 */
	private collapseLabel: HTMLElement;
	/**
	 * @private
	 * @type {Element}
	 */
	private label: HTMLElement;
	/**
	 * A list of currently rendered resolutions.
	 * @type {Array.<string>}
	 * @private
	 */
	private renderedAttributions: string[];
	/**
	 * @private
	 * @type {boolean}
	 */
	private renderedVisible: boolean;
	/**
	 * @constructor
	 * @extends {module:ol/control/Control}
	 * @param {module:ol/control/Attribution~Options=} opt_options Attribution options.
	 * @api
	 */
	constructor(opt_options: Options) {

		const options = opt_options ? opt_options : {} as Options;
		if (options.collapsed === undefined) {
			options.collapsed = true;
		}
		if (options.collapsible === undefined) {
			options.collapsible = true;
		}

		const collapseLabel = (() => {
			const _label = options.collapseLabel !== undefined ? options.collapseLabel : '\u00BB';
			if (typeof _label === 'string') {
				const span = document.createElement('span');
				span.textContent = _label;
				return span;
			} else {
				return _label;
			}
		})();
		const label = (() => {
			const _label = options.label !== undefined ? options.label : 'i';

			if (typeof _label === 'string') {
				const span = document.createElement('span');
				span.textContent = _label;
				return span;
			} else {
				return _label;
			}
		})();
		const className = options.className !== undefined ? options.className : 'ol-attribution';
		const tipLabel = options.tipLabel !== undefined ? options.tipLabel : 'Attributions';
		const activeLabel = (options.collapsible && !options.collapsed) ?
			collapseLabel : label;

		const cssClasses = className + ' ' + CLASS_UNSELECTABLE + ' ' + CLASS_CONTROL +
			(options.collapsed && options.collapsible ? ' ' + CLASS_COLLAPSED : '') +
			(options.collapsible ? '' : ' ol-uncollapsible');

		const ulElement = document.createElement('ul');

		const button = document.createElement('button');
		button.setAttribute('type', 'button');
		button.title = tipLabel;
		button.appendChild(activeLabel);

		const element = document.createElement('div');
		element.className = cssClasses;
		element.appendChild(ulElement);
		element.appendChild(button);
		super({
			element,
			render: options.render || ((e: MapEvent) => {
				this.updateElement_(e.frameState!);
			}),
			target: options.target
		});

		this.ulElement = ulElement;

		this.collapsed = options.collapsed;

		this.collapsible = options.collapsible;

		if (!this.collapsible) {
			this.collapsed = false;
		}

		this.collapseLabel = collapseLabel;

		this.label = label;

		listen(button, EventType.CLICK, this.handleClick_ as any, this);
		this.renderedAttributions = [];
		this.renderedVisible = true;
	}

	/**
	 * Get a list of visible attributions.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @return {Array.<string>} Attributions.
	 * @private
	 */
	public getSourceAttributions_(frameState: FrameState) {
		/**
		 * Used to determine if an attribution already exists.
		 * @type {!Object.<string, boolean>}
		 */
		const lookup = {} as { [s: string]: boolean; };

		/**
		 * A list of visible attributions.
		 * @type {Array.<string>}
		 */
		const visibleAttributions = [];

		const layerStatesArray = frameState.layerStatesArray;
		const resolution = frameState.viewState.resolution;
		for (let i = 0, ii = layerStatesArray.length; i < ii; ++i) {
			const layerState = layerStatesArray[i];
			if (!visibleAtResolution(layerState, resolution)) {
				continue;
			}

			const source = layerState.layer.getSource();
			if (!source) {
				continue;
			}

			const attributionGetter = source.getAttributions();
			if (!attributionGetter) {
				continue;
			}

			const attributions = attributionGetter(frameState);
			if (!attributions) {
				continue;
			}

			if (Array.isArray(attributions)) {
				for (let j = 0, jj = attributions.length; j < jj; ++j) {
					if (!(attributions[j] in lookup)) {
						visibleAttributions.push(attributions[j]);
						lookup[attributions[j]] = true;
					}
				}
			} else {
				if (!(attributions in lookup)) {
					visibleAttributions.push(attributions);
					lookup[attributions] = true;
				}
			}
		}
		return visibleAttributions;
	}


	/**
	 * @private
	 * @param {?module:ol/PluggableMap~FrameState} frameState Frame state.
	 */
	public updateElement_(frameState: FrameState) {
		if (!frameState) {
			if (this.renderedVisible) {
				this.element.style.display = 'none';
				this.renderedVisible = false;
			}
			return;
		}

		const attributions = this.getSourceAttributions_(frameState);

		const visible = attributions.length > 0;
		if (this.renderedVisible !== visible) {
			this.element.style.display = visible ? '' : 'none';
			this.renderedVisible = visible;
		}

		if (equals(attributions, this.renderedAttributions)) {
			return;
		}

		removeChildren(this.ulElement);

		// append the attributions
		for (let i = 0, ii = attributions.length; i < ii; ++i) {
			const element = document.createElement('LI');
			element.innerHTML = attributions[i];
			this.ulElement.appendChild(element);
		}

		this.renderedAttributions = attributions;
	}


	/**
	 * @param {Event} event The event to handle
	 * @private
	 */
	public handleClick_(event: Event) {
		event.preventDefault();
		this.handleToggle_();
	}


	/**
	 * @private
	 */
	public handleToggle_() {
		this.element.classList.toggle(CLASS_COLLAPSED);
		if (this.collapsed) {
			replaceNode(this.collapseLabel, this.label);
		} else {
			replaceNode(this.label, this.collapseLabel);
		}
		this.collapsed = !this.collapsed;
	}


	/**
	 * Return `true` if the attribution is collapsible, `false` otherwise.
	 * @return {boolean} True if the widget is collapsible.
	 * @api
	 */
	public getCollapsible() {
		return this.collapsible;
	}


	/**
	 * Set whether the attribution should be collapsible.
	 * @param {boolean} collapsible True if the widget is collapsible.
	 * @api
	 */
	public setCollapsible(collapsible: boolean) {
		if (this.collapsible === collapsible) {
			return;
		}
		this.collapsible = collapsible;
		this.element.classList.toggle('ol-uncollapsible');
		if (!collapsible && this.collapsed) {
			this.handleToggle_();
		}
	}


	/**
	 * Collapse or expand the attribution according to the passed parameter. Will
	 * not do anything if the attribution isn't collapsible or if the current
	 * collapsed state is already the one requested.
	 * @param {boolean} collapsed True if the widget is collapsed.
	 * @api
	 */
	public setCollapsed(collapsed: boolean) {
		if (!this.collapsible || this.collapsed === collapsed) {
			return;
		}
		this.handleToggle_();
	}


	/**
	 * Return `true` when the attribution is currently collapsed or `false`
	 * otherwise.
	 * @return {boolean} True if the widget is collapsed.
	 * @api
	 */
	public getCollapsed() {
		return this.collapsed;
	}
}
