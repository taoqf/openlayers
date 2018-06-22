/**
 * @module ol/layer/Group
 */
import { assert } from '../asserts';
import Collection, { CollectionEvent } from '../Collection';
import CollectionEventType from '../CollectionEventType';
import { EventsKey, listen, unlistenByKey } from '../events';
import Event from '../events/Event';
import EventType from '../events/EventType';
import { Extent, getIntersection } from '../extent';
import { getUid } from '../index';
import BaseLayer from '../layer/Base';
import { assign, clear } from '../obj';
import { getChangeEventType } from '../Object';
import ObjectEventType from '../ObjectEventType';
import SourceState from '../source/State';
import Layer, { LayerState } from './Layer';


/**
 * @typedef {Object} Options
 * @property {number} [opacity=1] Opacity (0, 1).
 * @property {boolean} [visible=true] Visibility.
 * @property {module:ol/extent~Extent} [extent] The bounding extent for layer rendering.  The layer will not be
 * rendered outside of this extent.
 * @property {number} [zIndex=0] The z-index for layer rendering.  At rendering time, the layers
 * will be ordered, first by Z-index and then by position.
 * @property {number} [minResolution] The minimum resolution (inclusive) at which this layer will be
 * visible.
 * @property {number} [maxResolution] The maximum resolution (exclusive) below which this layer will
 * be visible.
 * @property {(Array.<module:ol/layer/Base>|module:ol/Collection.<module:ol/layer/Base>)} [layers] Child layers.
 */

export interface Options {
	opacity: number;
	visible: boolean;
	extent: Extent;
	zIndex: number;
	minResolution: number;
	maxResolution: number;
	layers: BaseLayer[] | Collection<BaseLayer>;
}

/**
 * @enum {string}
 * @private
 */
enum Property {
	LAYERS = 'layers'
}


/**
 * @classdesc
 * A {@link module:ol/Collection~Collection} of layers that are handled together.
 *
 * A generic `change` event is triggered when the group/Collection changes.
 *
 * @constructor
 * @extends {module:ol/layer/Base}
 * @param {module:ol/layer/Group~Options=} opt_options Layer options.
 * @api
 */
export default class LayerGroup extends BaseLayer {
	private layersListenerKeys_: EventsKey[];
	private listenerKeys_: { [k: string]: EventsKey[]; };
	constructor(opt_options?: Partial<Options>) {
		const options = opt_options || {};
		const baseOptions = /** @type {module:ol/layer/Group~Options} */ (assign({}, options));
		delete baseOptions.layers;
		super(baseOptions);

		let layers = options.layers;


		/**
		 * @private
		 * @type {Array.<module:ol/events~EventsKey>}
		 */
		this.layersListenerKeys_ = [];

		/**
		 * @private
		 * @type {Object.<string, Array.<module:ol/events~EventsKey>>}
		 */
		this.listenerKeys_ = {};

		listen(this,
			getChangeEventType(Property.LAYERS),
			this.handleLayersChanged_, this);

		if (layers) {
			if (Array.isArray(layers)) {
				layers = new Collection(layers.slice(), { unique: true });
			} else {
				assert(layers instanceof Collection,
					43); // Expected `layers` to be an array or a `Collection`
				layers = layers;
			}
		} else {
			layers = new Collection(undefined, { unique: true });
		}

		this.setLayers(layers);

	}

	/**
	 * Returns the {@link module:ol/Collection collection} of {@link module:ol/layer/Layer~Layer layers}
	 * in this group.
	 * @return {!module:ol/Collection.<module:ol/layer/Base>} Collection of
	 *   {@link module:ol/layer/Base layers} that are part of this group.
	 * @observable
	 * @api
	 */
	public getLayers() {
		return (
		/** @type {!module:ol/Collection.<module:ol/layer/Base>} */ (this.get(Property.LAYERS))
		) as Collection<BaseLayer>;
	}


	/**
	 * Set the {@link module:ol/Collection collection} of {@link module:ol/layer/Layer~Layer layers}
	 * in this group.
	 * @param {!module:ol/Collection.<module:ol/layer/Base>} layers Collection of
	 *   {@link module:ol/layer/Base layers} that are part of this group.
	 * @observable
	 * @api
	 */
	public setLayers(layers: Collection<BaseLayer>) {
		this.set(Property.LAYERS, layers);
	}


	/**
	 * @inheritDoc
	 */
	public getLayersArray(opt_array?: Layer[]) {
		const array = opt_array !== undefined ? opt_array : [];
		this.getLayers().forEach((layer) => {
			layer.getLayersArray(array);
		});
		return array;
	}


	/**
	 * @inheritDoc
	 */
	public getLayerStatesArray(opt_states?: LayerState[]) {
		const states = opt_states !== undefined ? opt_states : [];

		const pos = states.length;

		this.getLayers().forEach((layer) => {
			layer.getLayerStatesArray(states);
		});

		const ownLayerState = this.getLayerState();
		for (let i = pos, ii = states.length; i < ii; i++) {
			const layerState = states[i];
			layerState.opacity *= ownLayerState.opacity;
			layerState.visible = layerState.visible && ownLayerState.visible;
			layerState.maxResolution = Math.min(
				layerState.maxResolution, ownLayerState.maxResolution);
			layerState.minResolution = Math.max(
				layerState.minResolution, ownLayerState.minResolution);
			if (ownLayerState.extent !== undefined) {
				if (layerState.extent !== undefined) {
					layerState.extent = getIntersection(layerState.extent, ownLayerState.extent);
				} else {
					layerState.extent = ownLayerState.extent;
				}
			}
		}

		return states;
	}

	/**
	 * @inheritDoc
	 */
	public getSourceState() {
		return SourceState.READY;
	}

	/**
	 * @private
	 */
	private handleLayerChange_() {
		this.changed();
	}

	/**
	 * @param {module:ol/events/Event} event Event.
	 * @private
	 */
	private handleLayersChanged_(_event: Event) {
		this.layersListenerKeys_.forEach(unlistenByKey);
		this.layersListenerKeys_.length = 0;

		const layers = this.getLayers();
		this.layersListenerKeys_.push(
			listen(layers, CollectionEventType.ADD, this.handleLayersAdd_, this)!,
			listen(layers, CollectionEventType.REMOVE, this.handleLayersRemove_, this)!
		);

		Object.keys(this.listenerKeys_).forEach((id) => {
			this.listenerKeys_[id].forEach(unlistenByKey);
		});
		clear(this.listenerKeys_);

		const layersArray = layers.getArray();
		for (let i = 0, ii = layersArray.length; i < ii; i++) {
			const layer = layersArray[i];
			this.listenerKeys_[getUid(layer).toString()] = [
				listen(layer, ObjectEventType.PROPERTYCHANGE, this.handleLayerChange_, this)!,
				listen(layer, EventType.CHANGE, this.handleLayerChange_, this)!
			];
		}

		this.changed();
	}


	/**
	 * @param {module:ol/Collection~CollectionEvent} collectionEvent CollectionEvent.
	 * @private
	 */
	private handleLayersAdd_(collectionEvent: CollectionEvent) {
		const layer = /** @type {module:ol/layer/Base} */ (collectionEvent.element);
		const key = getUid(layer).toString();
		this.listenerKeys_[key] = [
			listen(layer, ObjectEventType.PROPERTYCHANGE, this.handleLayerChange_, this)!,
			listen(layer, EventType.CHANGE, this.handleLayerChange_, this)!
		];
		this.changed();
	}


	/**
	 * @param {module:ol/Collection~CollectionEvent} collectionEvent CollectionEvent.
	 * @private
	 */
	private handleLayersRemove_(collectionEvent: CollectionEvent) {
		const layer = /** @type {module:ol/layer/Base} */ (collectionEvent.element);
		const key = getUid(layer).toString();
		this.listenerKeys_[key].forEach(unlistenByKey);
		delete this.listenerKeys_[key];
		this.changed();
	}
}
