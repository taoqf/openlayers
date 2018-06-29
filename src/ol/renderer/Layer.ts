/**
 * @module ol/renderer/Layer
 */
import { Coordinate } from '../coordinate';
import { listen } from '../events';
import Event from '../events/Event';
import EventType from '../events/EventType';
import { Extent } from '../extent';
import Feature from '../Feature';
import ImageBase from '../ImageBase';
import ImageState from '../ImageState';
import { getUid } from '../index';
import Layer from '../layer/Layer';
import Observable from '../Observable';
import PluggableMap, { FrameState } from '../PluggableMap';
import Projection from '../proj/Projection';
import RenderFeature from '../render/Feature';
import SourceState from '../source/State';
import TileSource from '../source/Tile';
import Tile from '../Tile';
import TileGrid from '../tilegrid/TileGrid';
import TileRange from '../TileRange';
import TileState from '../TileState';
import MapRenderer from './Map';

/**
 * @constructor
 * @extends {module:ol/Observable}
 * @param {module:ol/layer/Layer} layer Layer.
 * @struct
 */
export default abstract class LayerRenderer extends Observable {
	private layer_: Layer;
	constructor(layer: Layer) {
		super();
		/**
		 * @private
		 * @type {module:ol/layer/Layer}
		 */
		this.layer_ = layer;
	}
	public handles(_layer: Layer) {
		return false;
	}
	public create(_map: MapRenderer, _layer: Layer) { }
	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @param {number} hitTolerance Hit tolerance in pixels.
	 * @param {function(this: S, (module:ol/Feature|module:ol/render/Feature), module:ol/layer/Layer): T}
	 *     callback Feature callback.
	 * @param {S} thisArg Value to use as `this` when executing `callback`.
	 * @return {T|undefined} Callback result.
	 * @template S,T
	 */
	public forEachFeatureAtCoordinate<S, T>(_coordinate: Coordinate, _frameState: FrameState, _hitTolerance: number, _callback: (this: S, feature: Feature | RenderFeature, layer: Layer) => T, _thisArg?: S): T | undefined | void { }

	/**
	 * @param {module:ol/coordinate~Coordinate} coordinate Coordinate.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @return {boolean} Is there a feature at the given coordinate?
	 */
	public hasFeatureAtCoordinate(_coordinate: Coordinate, _frameState: FrameState) {
		return false;
	}


	/**
	 * @return {module:ol/layer/Layer} Layer.
	 */
	public getLayer() {
		return this.layer_;
	}

	/**
	 * Create a function that adds loaded tiles to the tile lookup.
	 * @param {module:ol/source/Tile} source Tile source.
	 * @param {module:ol/proj/Projection} projection Projection of the tiles.
	 * @param {Object.<number, Object.<string, module:ol/Tile>>} tiles Lookup of loaded tiles by zoom level.
	 * @return {function(number, module:ol/TileRange):boolean} A function that can be
	 *     called with a zoom level and a tile range to add loaded tiles to the lookup.
	 * @protected
	 */
	protected createLoadedTileFinder(source: TileSource, projection: Projection, tiles: { [zoom: number]: { [tileCoord: string]: Tile; }; }) {
		return (
			/**
			 * @param {number} zoom Zoom level.
			 * @param {module:ol/TileRange} tileRange Tile range.
			 * @return {boolean} The tile range is fully loaded.
			 */
			(zoom: number, tileRange: TileRange) => {
				return source.forEachLoadedTile(projection, zoom, tileRange, (tile: Tile) => {
					if (!tiles[zoom]) {
						tiles[zoom] = {};
					}
					tiles[zoom][tile.tileCoord.toString()] = tile;
				});
			}
		);
	}

	/**
	 * Load the image if not already loaded, and register the image change
	 * listener if needed.
	 * @param {module:ol/ImageBase} image Image.
	 * @return {boolean} `true` if the image is already loaded, `false` otherwise.
	 * @protected
	 */
	protected loadImage(image: ImageBase) {
		let imageState = image.getState();
		if (imageState !== ImageState.LOADED && imageState !== ImageState.ERROR) {
			listen(image, EventType.CHANGE, this.handleImageChange_, this);
		}
		if (imageState === ImageState.IDLE) {
			image.load();
			imageState = image.getState();
		}
		return imageState === ImageState.LOADED;
	}


	/**
	 * @protected
	 */
	protected renderIfReadyAndVisible() {
		const layer = this.getLayer();
		if (layer.getVisible() && layer.getSourceState() === SourceState.READY) {
			this.changed();
		}
	}


	/**
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @param {module:ol/source/Tile} tileSource Tile source.
	 * @protected
	 */
	protected scheduleExpireCache(frameState: FrameState, tileSource: TileSource) {
		if (tileSource.canExpireCache()) {
			frameState.postRenderFunctions.push(
				/** @type {module:ol/PluggableMap~PostRenderFunction} */(_map: PluggableMap, frame_state: FrameState) => {
					const tileSourceKey = getUid(tileSource).toString();
					if (tileSourceKey in frame_state.usedTiles) {
						tileSource.expireCache(frame_state.viewState.projection,
							frame_state.usedTiles[tileSourceKey]);
					}
				}
			);
		}
	}


	/**
	 * @param {!Object.<string, !Object.<string, module:ol/TileRange>>} usedTiles Used tiles.
	 * @param {module:ol/source/Tile} tileSource Tile source.
	 * @param {number} z Z.
	 * @param {module:ol/TileRange} tileRange Tile range.
	 * @protected
	 */
	protected updateUsedTiles(usedTiles: { [s: string]: { [s: string]: TileRange }; }, tileSource: TileSource, z: number, tileRange: TileRange) {
		// FIXME should we use tilesToDrawByZ instead?
		const tileSourceKey = getUid(tileSource).toString();
		const zKey = z.toString();
		if (tileSourceKey in usedTiles) {
			if (zKey in usedTiles[tileSourceKey]) {
				usedTiles[tileSourceKey][zKey].extend(tileRange);
			} else {
				usedTiles[tileSourceKey][zKey] = tileRange;
			}
		} else {
			usedTiles[tileSourceKey] = {};
			usedTiles[tileSourceKey][zKey] = tileRange;
		}
	}


	/**
	 * Manage tile pyramid.
	 * This function performs a number of functions related to the tiles at the
	 * current zoom and lower zoom levels:
	 * - registers idle tiles in frameState.wantedTiles so that they are not
	 *   discarded by the tile queue
	 * - enqueues missing tiles
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @param {module:ol/source/Tile} tileSource Tile source.
	 * @param {module:ol/tilegrid/TileGrid} tileGrid Tile grid.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {module:ol/proj/Projection} projection Projection.
	 * @param {module:ol/extent~Extent} extent Extent.
	 * @param {number} currentZ Current Z.
	 * @param {number} preload Load low resolution tiles up to 'preload' levels.
	 * @param {function(this: T, module:ol/Tile)=} opt_tileCallback Tile callback.
	 * @param {T=} opt_this Object to use as `this` in `opt_tileCallback`.
	 * @protected
	 * @template T
	 */
	protected manageTilePyramid<T>(frameState: FrameState, tileSource: TileSource, tileGrid: TileGrid, pixelRatio: number, projection: Projection, extent: Extent, currentZ: number, preload: number, opt_tileCallback?: (this: T, tile: Tile) => void, opt_this?: T) {
		const tileSourceKey = getUid(tileSource).toString();
		if (!(tileSourceKey in frameState.wantedTiles)) {
			frameState.wantedTiles[tileSourceKey] = {};
		}
		const wantedTiles = frameState.wantedTiles[tileSourceKey];
		const tileQueue = frameState.tileQueue;
		const minZoom = tileGrid.getMinZoom();
		let tileRange;
		for (let z = minZoom; z <= currentZ; ++z) {
			tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z, tileRange);
			const tileResolution = tileGrid.getResolution(z);
			for (let x = tileRange.minX; x <= tileRange.maxX; ++x) {
				for (let y = tileRange.minY; y <= tileRange.maxY; ++y) {
					if (currentZ - z <= preload) {
						const tile = tileSource.getTile(z, x, y, pixelRatio, projection);
						if (tile.getState() === TileState.IDLE) {
							wantedTiles[tile.getKey()] = true;
							if (!tileQueue.isKeyQueued(tile.getKey())) {
								tileQueue.enqueue([tile, tileSourceKey,
									tileGrid.getTileCoordCenter(tile.tileCoord), tileResolution]);
							}
						}
						if (opt_tileCallback !== undefined) {
							opt_tileCallback.call(opt_this, tile);
						}
					} else {
						tileSource.useTile(z, x, y, projection);
					}
				}
			}
		}
	}

	/**
	 * Handle changes in image state.
	 * @param {module:ol/events/Event} event Image change event.
	 * @private
	 */
	private handleImageChange_(event: Event) {
		const image = /** @type {module:ol/Image} */ (event.target);
		if (image.getState() === ImageState.LOADED) {
			this.renderIfReadyAndVisible();
		}
	}

}
