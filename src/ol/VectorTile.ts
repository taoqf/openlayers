/**
 * @module ol/VectorTile
 */
import { Extent } from './extent';
import Feature from './Feature';
import { FeatureLoader } from './featureloader';
import FeatureFormat from './format/Feature';
import { getUid } from './index';
import Layer from './layer/Layer';
import Projection from './proj/Projection';
import ReplayGroup from './render/ReplayGroup';
import Tile, { LoadFunction, Options as TileOptions } from './Tile';
import { TileCoord } from './tilecoord';
import TileState from './TileState';

/**
 * @typedef {function(new: module:ol/VectorTile, module:ol/tilecoord~TileCoord,
 * module:ol/TileState, string, ?string, module:ol/Tile~LoadFunction)} TileClass
 * @api
 */

export type TileClass = (vt: VectorTile, tilecoord: TileCoord, tileState: TileState, s1: string, s2: string, loadFunc: LoadFunction) => void;


/**
 * @const
 * @type {module:ol/extent~Extent}
 */
const DEFAULT_EXTENT = [0, 0, 4096, 4096] as Extent;

/**
 * @constructor
 * @extends {module:ol/Tile}
 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
 * @param {module:ol/TileState} state State.
 * @param {string} src Data source url.
 * @param {module:ol/format/Feature} format Feature format.
 * @param {module:ol/Tile~LoadFunction} tileLoadFunction Tile load function.
 * @param {module:ol/Tile~Options=} opt_options Tile options.
 */
export default class VectorTile extends Tile {
	public consumers: number;
	private extent_: Extent | null;
	private format_: FeatureFormat;
	private features_: Feature[] | null;
	private loader_: FeatureLoader | null;
	private projection_: Projection | null;
	private replayGroups_: { [key: string]: ReplayGroup; };
	private tileLoadFunction_: LoadFunction;
	private url_: string;
	constructor(tileCoord: TileCoord, state: TileState, src: string, format: FeatureFormat, tileLoadFunction: LoadFunction, opt_options?: TileOptions) {

		super(tileCoord, state, opt_options);

		/**
		 * @type {number}
		 */
		this.consumers = 0;

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.extent_ = null;

		/**
		 * @private
		 * @type {module:ol/format/Feature}
		 */
		this.format_ = format;

		/**
		 * @private
		 * @type {Array.<module:ol/Feature>}
		 */
		this.features_ = null;

		/**
		 * @private
		 * @type {module:ol/featureloader~FeatureLoader}
		 */
		this.loader_ = null;

		/**
		 * Data projection
		 * @private
		 * @type {module:ol/proj/Projection}
		 */
		this.projection_ = null;

		/**
		 * @private
		 * @type {Object.<string, module:ol/render/ReplayGroup>}
		 */
		this.replayGroups_ = {};

		/**
		 * @private
		 * @type {module:ol/Tile~LoadFunction}
		 */
		this.tileLoadFunction_ = tileLoadFunction;

		/**
		 * @private
		 * @type {string}
		 */
		this.url_ = src;

	}

	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		this.features_ = null;
		this.replayGroups_ = {};
		this.state = TileState.ABORT;
		this.changed();
		Tile.prototype.disposeInternal.call(this);
	}


	/**
	 * Gets the extent of the vector tile.
	 * @return {module:ol/extent~Extent} The extent.
	 * @api
	 */
	public getExtent() {
		return this.extent_ || DEFAULT_EXTENT;
	}


	/**
	 * Get the feature format assigned for reading this tile's features.
	 * @return {module:ol/format/Feature} Feature format.
	 * @api
	 */
	public getFormat() {
		return this.format_;
	}


	/**
	 * Get the features for this tile. Geometries will be in the projection returned
	 * by {@link module:ol/VectorTile~VectorTile#getProjection}.
	 * @return {Array.<module:ol/Feature|module:ol/render/Feature>} Features.
	 * @api
	 */
	public getFeatures() {
		return this.features_;
	}


	/**
	 * @inheritDoc
	 */
	public getKey() {
		return this.url_;
	}


	/**
	 * Get the feature projection of features returned by
	 * {@link module:ol/VectorTile~VectorTile#getFeatures}.
	 * @return {module:ol/proj/Projection} Feature projection.
	 * @api
	 */
	public getProjection() {
		return this.projection_;
	}


	/**
	 * @param {module:ol/layer/Layer} layer Layer.
	 * @param {string} key Key.
	 * @return {module:ol/render/ReplayGroup} Replay group.
	 */
	public getReplayGroup(layer: Layer, key: string) {
		return this.replayGroups_[getUid(layer) + ',' + key];
	}


	/**
	 * @inheritDoc
	 */
	public load() {
		if (this.state === TileState.IDLE) {
			this.setState(TileState.LOADING);
			this.tileLoadFunction_(this, this.url_);
			this.loader_!(null!, null!, NaN!, null!);
			// todo this.loader_(null, NaN, null, null);
		}
	}


	/**
	 * Handler for successful tile load.
	 * @param {Array.<module:ol/Feature>} features The loaded features.
	 * @param {module:ol/proj/Projection} dataProjection Data projection.
	 * @param {module:ol/extent~Extent} extent Extent.
	 */
	public onLoad(features: Feature[], dataProjection: Projection, extent: Extent) {
		this.setProjection(dataProjection);
		this.setFeatures(features);
		this.setExtent(extent);
	}


	/**
	 * Handler for tile load errors.
	 */
	public onError() {
		this.setState(TileState.ERROR);
	}


	/**
	 * Function for use in an {@link module:ol/source/VectorTile~VectorTile}'s
	 * `tileLoadFunction`. Sets the extent of the vector tile. This is only required
	 * for tiles in projections with `tile-pixels` as units. The extent should be
	 * set to `[0, 0, tilePixelSize, tilePixelSize]`, where `tilePixelSize` is
	 * calculated by multiplying the tile size with the tile pixel ratio. For
	 * sources using {@link module:ol/format/MVT~MVT} as feature format, the
	 * {@link module:ol/format/MVT~MVT#getLastExtent} method will return the correct
	 * extent. The default is `[0, 0, 4096, 4096]`.
	 * @param {module:ol/extent~Extent} extent The extent.
	 * @api
	 */
	public setExtent(extent: Extent) {
		this.extent_ = extent;
	}


	/**
	 * Function for use in an {@link module:ol/source/VectorTile~VectorTile}'s `tileLoadFunction`.
	 * Sets the features for the tile.
	 * @param {Array.<module:ol/Feature>} features Features.
	 * @api
	 */
	public setFeatures(features: Feature[]) {
		this.features_ = features;
		this.setState(TileState.LOADED);
	}


	/**
	 * Function for use in an {@link module:ol/source/VectorTile~VectorTile}'s `tileLoadFunction`.
	 * Sets the projection of the features that were added with
	 * {@link module:ol/VectorTile~VectorTile#setFeatures}.
	 * @param {module:ol/proj/Projection} projection Feature projection.
	 * @api
	 */
	public setProjection(projection: Projection) {
		this.projection_ = projection;
	}


	/**
	 * @param {module:ol/layer/Layer} layer Layer.
	 * @param {string} key Key.
	 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
	 */
	public setReplayGroup(layer: Layer, key: string, replayGroup: ReplayGroup) {
		this.replayGroups_[getUid(layer) + ',' + key] = replayGroup;
	}


	/**
	 * Set the feature loader for reading this tile's features.
	 * @param {module:ol/featureloader~FeatureLoader} loader Feature loader.
	 * @api
	 */
	public setLoader(loader: FeatureLoader) {
		this.loader_ = loader;
	}
}
