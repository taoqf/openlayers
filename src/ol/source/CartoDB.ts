/**
 * @module ol/source/CartoDB
 */
import Event from '../events/Event';
import { assign } from '../obj';
import { ProjectionLike } from '../proj';
import SourceState from '../source/State';
import XYZ from '../source/XYZ';
import { AttributionLike } from './Source';

/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {number} [cacheSize=2048] Cache size.
 * @property {null|string} [crossOrigin] The `crossOrigin` attribute for loaded images.  Note that
 * you must provide a `crossOrigin` value if you are using the WebGL renderer or if you want to
 * access pixel data with the Canvas renderer.  See
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image} for more detail.
 * @property {module:ol/proj~ProjectionLike} [projection='EPSG:3857'] Projection.
 * @property {number} [maxZoom=18] Max zoom.
 * @property {number} [minZoom] Minimum zoom.
 * @property {boolean} [wrapX=true] Whether to wrap the world horizontally.
 * @property {Object} [config] If using anonymous maps, the CartoDB config to use. See
 * {@link http://docs.cartodb.com/cartodb-platform/maps-api/anonymous-maps/}
 * for more detail.
 * If using named maps, a key-value lookup with the template parameters.
 * See {@link http://docs.cartodb.com/cartodb-platform/maps-api/named-maps/}
 * for more detail.
 * @property {string} [map] If using named maps, this will be the name of the template to load.
 * See {@link http://docs.cartodb.com/cartodb-platform/maps-api/named-maps/}
 * for more detail.
 * @property {string} account If using named maps, this will be the name of the template to load.
 */
export interface Options {
	attributions: AttributionLike;
	cacheSize: number;
	crossOrigin: null | string;
	projection: ProjectionLike;
	maxZoom: number;
	minZoom: number;
	wrapX: boolean;
	config: any;
	map: string;
	account: string;
}

/**
 * @classdesc
 * Layer source for the CartoDB Maps API.
 *
 * @constructor
 * @extends {module:ol/source/XYZ}
 * @param {module:ol/source/CartoDB~Options=} options CartoDB options.
 * @api
 */
export default class CartoDB extends XYZ {
	private account_: string;
	private mapId_: string;
	private config_: any;
	private templateCache_: { [key: string]: any; };
	constructor(options: Partial<Options>) {
		super({
			attributions: options.attributions,
			cacheSize: options.cacheSize,
			crossOrigin: options.crossOrigin,
			maxZoom: options.maxZoom !== undefined ? options.maxZoom : 18,
			minZoom: options.minZoom,
			projection: options.projection,
			state: SourceState.LOADING,
			wrapX: options.wrapX
		});
		/**
		 * @type {string}
		 * @private
		 */
		this.account_ = options.account;

		/**
		 * @type {string}
		 * @private
		 */
		this.mapId_ = options.map || '';

		/**
		 * @type {!Object}
		 * @private
		 */
		this.config_ = options.config || {};

		/**
		 * @type {!Object.<string, CartoDBLayerInfo>}
		 * @private
		 */
		this.templateCache_ = {};

		this.initializeMap_();
	}


	/**
	 * Returns the current config.
	 * @return {!Object} The current configuration.
	 * @api
	 */
	public getConfig() {
		return this.config_;
	}

	/**
	 * Updates the carto db config.
	 * @param {Object} config a key-value lookup. Values will replace current values
	 *     in the config.
	 * @api
	 */
	public updateConfig(config: any) {
		assign(this.config_, config);
		this.initializeMap_();
	}


	/**
	 * Sets the CartoDB config
	 * @param {Object} config In the case of anonymous maps, a CartoDB configuration
	 *     object.
	 * If using named maps, a key-value lookup with the template parameters.
	 * @api
	 */
	public setConfig(config: any) {
		this.config_ = config || {};
		this.initializeMap_();
	}


	/**
	 * Issue a request to initialize the CartoDB map.
	 * @private
	 */
	private initializeMap_() {
		const paramHash = JSON.stringify(this.config_);
		if (this.templateCache_[paramHash]) {
			this.applyTemplate_(this.templateCache_[paramHash]);
			return;
		}
		let mapUrl = 'https://' + this.account_ + '.carto.com/api/v1/map';

		if (this.mapId_) {
			mapUrl += '/named/' + this.mapId_;
		}

		const client = new XMLHttpRequest();
		client.addEventListener('load', this.handleInitResponse_.bind(this, paramHash));
		client.addEventListener('error', this.handleInitError_.bind(this));
		client.open('POST', mapUrl);
		client.setRequestHeader('Content-type', 'application/json');
		client.send(JSON.stringify(this.config_));
	}


	/**
	 * Handle map initialization response.
	 * @param {string} paramHash a hash representing the parameter set that was used
	 *     for the request
	 * @param {Event} event Event.
	 * @private
	 */
	private handleInitResponse_(paramHash: string | number, event: Event) {
		const client = /** @type {XMLHttpRequest} */ (event.target);
		// status will be 0 for file:// urls
		if (!client.status || client.status >= 200 && client.status < 300) {
			let response;
			try {
				response = /** @type {CartoDBLayerInfo} */(JSON.parse(client.responseText));
			} catch (err) {
				this.setState(SourceState.ERROR);
				return;
			}
			this.applyTemplate_(response);
			this.templateCache_[paramHash] = response;
			this.setState(SourceState.READY);
		} else {
			this.setState(SourceState.ERROR);
		}
	}

	/**
	 * @private
	 * @param {Event} event Event.
	 */
	private handleInitError_(_event: Event) {
		this.setState(SourceState.ERROR);
	}


	/**
	 * Apply the new tile urls returned by carto db
	 * @param {CartoDBLayerInfo} data Result of carto db call.
	 * @private
	 */
	private applyTemplate_(data: any) {
		const tilesUrl = 'https://' + data.cdn_url.https + '/' + this.account_ +
			'/api/v1/map/' + data.layergroupid + '/{z}/{x}/{y}.png';
		this.setUrl(tilesUrl);
	}
}
