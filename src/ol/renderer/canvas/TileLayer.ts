/**
 * @module ol/renderer/canvas/TileLayer
 */
import { createCanvasContext2D } from '../../dom';
import { containsExtent, createEmpty, equals, Extent, getIntersection, isEmpty } from '../../extent';
import { getUid } from '../../index';
import Layer, { LayerState } from '../../layer/Layer';
import TileLayer from '../../layer/Tile';
import VectorLayer from '../../layer/Vector';
import LayerType from '../../LayerType';
import { FrameState } from '../../PluggableMap';
import Projection from '../../proj/Projection';
import TileSource from '../../source/Tile';
import Tile from '../../Tile';
import TileRange from '../../TileRange';
import TileState from '../../TileState';
import { compose as composeTransform, create as createTransform } from '../../transform';
import ViewHint from '../../ViewHint';
import IntermediateCanvasRenderer from '../canvas/IntermediateCanvas';
import MapRenderer from '../Map';

/**
 * @constructor
 * @extends {module:ol/renderer/canvas/IntermediateCanvas}
 * @param {module:ol/layer/Tile|module:ol/layer/VectorTile} tileLayer Tile layer.
 * @api
 */
export default class CanvasTileLayerRenderer extends IntermediateCanvasRenderer {
	protected context: CanvasRenderingContext2D;
	protected tmpExtent: Extent;
	protected renderedRevision: number | undefined;
	protected renderedTiles: Tile[];
	protected zDirection: number;
	private oversampling_: number | undefined;
	private renderedExtent_: Extent | null;
	private newTiles_: boolean;
	private tmpTileRange_: TileRange;
	private imageTransform_: number[];
	constructor(tileLayer: TileLayer | VectorLayer) {
		super(tileLayer);

		/**
		 * @protected
		 * @type {CanvasRenderingContext2D}
		 */
		this.context = createCanvasContext2D();

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.renderedExtent_ = null;

		/**
		 * @protected
		 * @type {!Array.<module:ol/Tile>}
		 */
		this.renderedTiles = [];

		/**
		 * @private
		 * @type {boolean}
		 */
		this.newTiles_ = false;

		/**
		 * @protected
		 * @type {module:ol/extent~Extent}
		 */
		this.tmpExtent = createEmpty();

		/**
		 * @private
		 * @type {module:ol/TileRange}
		 */
		this.tmpTileRange_ = new TileRange(0, 0, 0, 0);

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.imageTransform_ = createTransform();

		/**
		 * @protected
		 * @type {number}
		 */
		this.zDirection = 0;

	}

	/**
	 * Determine if this renderer handles the provided layer.
	 * @param {module:ol/layer/Layer} layer The candidate layer.
	 * @return {boolean} The renderer can render the layer.
	 */
	public handles(layer: Layer) {
		return layer.getType() === LayerType.TILE;
	}


	/**
	 * Create a layer renderer.
	 * @param {module:ol/renderer/Map} mapRenderer The map renderer.
	 * @param {module:ol/layer/Layer} layer The layer to be rendererd.
	 * @return {module:ol/renderer/canvas/TileLayer} The layer renderer.
	 */
	public create(_mapRenderer: MapRenderer, layer: Layer) {
		return new CanvasTileLayerRenderer(/** @type {module:ol/layer/Tile} */(layer as TileLayer));
	}

	/**
	 * @param {number} z Tile coordinate z.
	 * @param {number} x Tile coordinate x.
	 * @param {number} y Tile coordinate y.
	 * @param {number} pixelRatio Pixel ratio.
	 * @param {module:ol/proj/Projection} projection Projection.
	 * @return {!module:ol/Tile} Tile.
	 */
	public getTile(z: number, x: number, y: number, pixelRatio: number, projection: Projection) {
		const layer = this.getLayer();
		const source = /** @type {module:ol/source/Tile} */ (layer.getSource() as TileSource);
		let tile = source.getTile(z, x, y, pixelRatio, projection);
		if (tile.getState() === TileState.ERROR) {
			if (!layer.getUseInterimTilesOnError()) {
				// When useInterimTilesOnError is false, we consider the error tile as loaded.
				tile.setState(TileState.LOADED);
			} else if (layer.getPreload() > 0) {
				// Preloaded tiles for lower resolutions might have finished loading.
				this.newTiles_ = true;
			}
		}
		if (!this.isDrawableTile_(tile)) {
			tile = tile.getInterimTile();
		}
		return tile;
	}

	/**
	 * @inheritDoc
	 */
	public prepareFrame(frameState: FrameState, layerState: LayerState) {

		const pixelRatio = frameState.pixelRatio;
		const size = frameState.size;
		const viewState = frameState.viewState;
		const projection = viewState.projection;
		const viewResolution = viewState.resolution;
		const viewCenter = viewState.center;

		const tileLayer = this.getLayer();
		const tileSource = /** @type {module:ol/source/Tile} */ (tileLayer.getSource());
		const sourceRevision = tileSource.getRevision();
		const tileGrid = tileSource.getTileGridForProjection(projection);
		const z = tileGrid.getZForResolution(viewResolution, this.zDirection);
		const tileResolution = tileGrid.getResolution(z);
		let oversampling = Math.round(viewResolution / tileResolution) || 1;
		let extent = frameState.extent;

		if (layerState.extent !== undefined) {
			extent = getIntersection(extent, layerState.extent);
		}
		if (isEmpty(extent)) {
			// Return false to prevent the rendering of the layer.
			return false;
		}

		const tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);
		const imageExtent = tileGrid.getTileRangeExtent(z, tileRange);

		const tilePixelRatio = tileSource.getTilePixelRatio(pixelRatio);

		/**
		 * @type {Object.<number, Object.<string, module:ol/Tile>>}
		 */
		const tilesToDrawByZ = {} as { [z: number]: { [s: string]: Tile; }; };
		tilesToDrawByZ[z] = {};

		const findLoadedTiles = this.createLoadedTileFinder(
			tileSource, projection, tilesToDrawByZ);

		const hints = frameState.viewHints;
		const animatingOrInteracting = hints[ViewHint.ANIMATING] || hints[ViewHint.INTERACTING];

		const tmpExtent = this.tmpExtent;
		const tmpTileRange = this.tmpTileRange_;
		this.newTiles_ = false;
		for (let x = tileRange.minX; x <= tileRange.maxX; ++x) {
			for (let y = tileRange.minY; y <= tileRange.maxY; ++y) {
				if (Date.now() - frameState.time > 16 && animatingOrInteracting) {
					continue;
				}
				const tile = this.getTile(z, x, y, pixelRatio, projection);
				if (this.isDrawableTile_(tile)) {
					const uid = getUid(this);
					if (tile.getState() === TileState.LOADED) {
						tilesToDrawByZ[z][tile.tileCoord.toString()] = tile;
						const inTransition = tile.inTransition(uid);
						if (!this.newTiles_ && (inTransition || this.renderedTiles.indexOf(tile) === -1)) {
							this.newTiles_ = true;
						}
					}
					if (tile.getAlpha(uid, frameState.time) === 1) {
						// don't look for alt tiles if alpha is 1
						continue;
					}
				}

				const childTileRange = tileGrid.getTileCoordChildTileRange(
					tile.tileCoord, tmpTileRange, tmpExtent);
				let covered = false;
				if (childTileRange) {
					covered = findLoadedTiles(z + 1, childTileRange);
				}
				if (!covered) {
					tileGrid.forEachTileCoordParentTileRange(
						tile.tileCoord, findLoadedTiles, null, tmpTileRange, tmpExtent);
				}

			}
		}

		const renderedResolution = tileResolution * pixelRatio / tilePixelRatio * oversampling;
		if (!(this.renderedResolution && Date.now() - frameState.time > 16 && animatingOrInteracting) && (
			this.newTiles_ ||
			!(this.renderedExtent_ && containsExtent(this.renderedExtent_, extent)) ||
			this.renderedRevision !== sourceRevision ||
			oversampling !== this.oversampling_ ||
			!animatingOrInteracting && renderedResolution !== this.renderedResolution
		)) {

			const context = this.context;
			if (context) {
				const tilePixelSize = tileSource.getTilePixelSize(z, pixelRatio, projection);
				const width = Math.round(tileRange.getWidth() * tilePixelSize[0] / oversampling);
				const height = Math.round(tileRange.getHeight() * tilePixelSize[1] / oversampling);
				const canvas = context.canvas;
				if (canvas.width !== width || canvas.height !== height) {
					this.oversampling_ = oversampling;
					canvas.width = width;
					canvas.height = height;
				} else {
					if (this.renderedExtent_ && !equals(imageExtent, this.renderedExtent_)) {
						context.clearRect(0, 0, width, height);
					}
					oversampling = this.oversampling_!;
				}
			}

			this.renderedTiles.length = 0;
			/** @type {Array.<number>} */
			const zs = Object.keys(tilesToDrawByZ).map(Number);
			zs.sort((a, b) => {
				if (a === z) {
					return 1;
				} else if (b === z) {
					return -1;
				} else {
					return a > b ? 1 : a < b ? -1 : 0;
				}
			});
			for (let i = 0, ii = zs.length; i < ii; ++i) {
				const currentZ = zs[i];
				const currentTilePixelSize = tileSource.getTilePixelSize(currentZ, pixelRatio, projection);
				const currentResolution = tileGrid.getResolution(currentZ);
				const currentScale = currentResolution / tileResolution;
				const tileGutter = tilePixelRatio * tileSource.getGutter(projection);
				const tilesToDraw = tilesToDrawByZ[currentZ];
				Object.keys(tilesToDraw).forEach((tileCoordKey) => {
					const tile = tilesToDraw[tileCoordKey];
					const tileExtent = tileGrid.getTileCoordExtent(tile.getTileCoord(), tmpExtent);
					const x = (tileExtent[0] - imageExtent[0]) / tileResolution * tilePixelRatio / oversampling;
					const y = (imageExtent[3] - tileExtent[3]) / tileResolution * tilePixelRatio / oversampling;
					const w = currentTilePixelSize[0] * currentScale / oversampling;
					const h = currentTilePixelSize[1] * currentScale / oversampling;
					this.drawTileImage(tile, frameState, layerState, x, y, w, h, tileGutter, z === currentZ);
					this.renderedTiles.push(tile);
				});
			}

			this.renderedRevision = sourceRevision;
			this.renderedResolution = tileResolution * pixelRatio / tilePixelRatio * oversampling;
			this.renderedExtent_ = imageExtent;
		}

		const scale = this.renderedResolution! / viewResolution;
		const transform = composeTransform(this.imageTransform_,
			pixelRatio * size[0] / 2, pixelRatio * size[1] / 2,
			scale, scale,
			0,
			(this.renderedExtent_![0] - viewCenter[0]) / this.renderedResolution! * pixelRatio,
			(viewCenter[1] - this.renderedExtent_![3]) / this.renderedResolution! * pixelRatio);
		composeTransform(this.coordinateToCanvasPixelTransform,
			pixelRatio * size[0] / 2 - transform[4], pixelRatio * size[1] / 2 - transform[5],
			pixelRatio / viewResolution, -pixelRatio / viewResolution,
			0,
			-viewCenter[0], -viewCenter[1]);


		this.updateUsedTiles(frameState.usedTiles, tileSource, z, tileRange);
		this.manageTilePyramid(frameState, tileSource, tileGrid, pixelRatio,
			projection, extent, z, tileLayer.getPreload());
		this.scheduleExpireCache(frameState, tileSource);

		return this.renderedTiles.length > 0;
	}


	/**
	 * @param {module:ol/Tile} tile Tile.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @param {module:ol/layer/Layer~State} layerState Layer state.
	 * @param {number} x Left of the tile.
	 * @param {number} y Top of the tile.
	 * @param {number} w Width of the tile.
	 * @param {number} h Height of the tile.
	 * @param {number} gutter Tile gutter.
	 * @param {boolean} transition Apply an alpha transition.
	 */
	public drawTileImage(tile: Tile, frameState: FrameState, _layerState: LayerState, x: number, y: number, w: number, h: number, gutter: number, transition: boolean) {
		const image = tile.getImage(this.getLayer());
		if (!image) {
			return;
		}
		const uid = getUid(this);
		const alpha = transition ? tile.getAlpha(uid, frameState.time) : 1;
		if (alpha === 1 && !this.getLayer().getSource().getOpaque(frameState.viewState.projection)) {
			this.context.clearRect(x, y, w, h);
		}
		const alphaChanged = alpha !== this.context.globalAlpha;
		if (alphaChanged) {
			this.context.save();
			this.context.globalAlpha = alpha;
		}
		this.context.drawImage(image, gutter, gutter,
			image.width - 2 * gutter, image.height - 2 * gutter, x, y, w, h);

		if (alphaChanged) {
			this.context.restore();
		}
		if (alpha !== 1) {
			frameState.animate = true;
		} else if (transition) {
			tile.endTransition(uid);
		}
	}


	/**
	 * @inheritDoc
	 */
	public getImage() {
		const context = this.context;
		return context ? context.canvas : null;
	}


	/**
	 * @function
	 * @return {module:ol/layer/Tile|module:ol/layer/VectorTile}
	 */
	public getLayer() {
		return super.getLayer() as /*VectorLayer | */TileLayer;
	}


	/**
	 * @inheritDoc
	 */
	public getImageTransform() {
		return this.imageTransform_;
	}

	/**
	 * @private
	 * @param {module:ol/Tile} tile Tile.
	 * @return {boolean} Tile is drawable.
	 */
	private isDrawableTile_(tile: Tile) {
		const tileState = tile.getState();
		const useInterimTilesOnError = this.getLayer().getUseInterimTilesOnError();
		return tileState === TileState.LOADED ||
			tileState === TileState.EMPTY ||
			tileState === TileState.ERROR && !useInterimTilesOnError;
	}
}
