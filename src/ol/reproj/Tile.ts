/**
 * @module ol/reproj/Tile
 */
import { EventsKey, listen, unlistenByKey } from '../events';
import EventType from '../events/EventType';
import { Extent, getArea, getCenter, getIntersection } from '../extent';
import { clamp } from '../math';
import Projection from '../proj/Projection';
import { calculateSourceResolution, render as renderReprojected } from '../reproj';
import Triangulation from '../reproj/Triangulation';
import Tile from '../Tile';
import { TileCoord } from '../tilecoord';
import TileGrid from '../tilegrid/TileGrid';
import TileState from '../TileState';
import { ERROR_THRESHOLD } from './common';


/**
 * @typedef {function(number, number, number, number) : module:ol/Tile} FunctionType
 */

export type FunctionType = (z: number, x: number, y: number, ratio: number) => ReprojTile;

/**
 * @classdesc
 * Class encapsulating single reprojected tile.
 * See {@link module:ol/source/TileImage~TileImage}.
 *
 * @constructor
 * @extends {module:ol/Tile}
 * @param {module:ol/proj/Projection} sourceProj Source projection.
 * @param {module:ol/tilegrid/TileGrid} sourceTileGrid Source tile grid.
 * @param {module:ol/proj/Projection} targetProj Target projection.
 * @param {module:ol/tilegrid/TileGrid} targetTileGrid Target tile grid.
 * @param {module:ol/tilecoord~TileCoord} tileCoord Coordinate of the tile.
 * @param {module:ol/tilecoord~TileCoord} wrappedTileCoord Coordinate of the tile wrapped in X.
 * @param {number} pixelRatio Pixel ratio.
 * @param {number} gutter Gutter of the source tiles.
 * @param {module:ol/reproj/Tile~FunctionType} getTileFunction
 *     Function returning source tiles (z, x, y, pixelRatio).
 * @param {number=} opt_errorThreshold Acceptable reprojection error (in px).
 * @param {boolean=} opt_renderEdges Render reprojection edges.
 */
export default class ReprojTile extends Tile {
	private renderEdges_: boolean;
	private pixelRatio_: number;
	private gutter_: number;
	private canvas_: HTMLCanvasElement | null;
	private sourceTileGrid_: TileGrid;
	private targetTileGrid_: TileGrid;
	private wrappedTileCoord_: TileCoord;
	private sourceTiles_: ReprojTile[];
	private sourcesListenerKeys_: EventsKey[] | null;
	private sourceZ_: number;
	private triangulation_: Triangulation | null = null;

	constructor(sourceProj: Projection, sourceTileGrid: TileGrid, targetProj: Projection, targetTileGrid: TileGrid, tileCoord: TileCoord, wrappedTileCoord: TileCoord, pixelRatio: number, gutter: number, getTileFunction: FunctionType, opt_errorThreshold?: number, opt_renderEdges?: boolean) {
		super(tileCoord, TileState.IDLE);

		/**
		 * @private
		 * @type {boolean}
		 */
		this.renderEdges_ = opt_renderEdges !== undefined ? opt_renderEdges : false;

		/**
		 * @private
		 * @type {number}
		 */
		this.pixelRatio_ = pixelRatio;

		/**
		 * @private
		 * @type {number}
		 */
		this.gutter_ = gutter;

		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas_ = null;

		/**
		 * @private
		 * @type {module:ol/tilegrid/TileGrid}
		 */
		this.sourceTileGrid_ = sourceTileGrid;

		/**
		 * @private
		 * @type {module:ol/tilegrid/TileGrid}
		 */
		this.targetTileGrid_ = targetTileGrid;

		/**
		 * @private
		 * @type {module:ol/tilecoord~TileCoord}
		 */
		this.wrappedTileCoord_ = wrappedTileCoord ? wrappedTileCoord : tileCoord;

		/**
		 * @private
		 * @type {!Array.<module:ol/Tile>}
		 */
		this.sourceTiles_ = [];

		/**
		 * @private
		 * @type {Array.<module:ol/events~EventsKey>}
		 */
		this.sourcesListenerKeys_ = null;

		/**
		 * @private
		 * @type {number}
		 */
		this.sourceZ_ = 0;

		const targetExtent = targetTileGrid.getTileCoordExtent(this.wrappedTileCoord_);
		const maxTargetExtent = this.targetTileGrid_.getExtent();
		let maxSourceExtent = this.sourceTileGrid_.getExtent()!;

		const limitedTargetExtent = maxTargetExtent ?
			getIntersection(targetExtent, maxTargetExtent) : targetExtent;

		if (getArea(limitedTargetExtent) === 0) {
			// Tile is completely outside range -> EMPTY
			// TODO: is it actually correct that the source even creates the tile ?
			this.state = TileState.EMPTY;
			return;
		}

		const sourceProjExtent = sourceProj.getExtent();
		if (sourceProjExtent) {
			if (!maxSourceExtent) {
				maxSourceExtent = sourceProjExtent;
			} else {
				maxSourceExtent = getIntersection(maxSourceExtent, sourceProjExtent);
			}
		}

		const targetResolution = targetTileGrid.getResolution(
			this.wrappedTileCoord_[0]);

		const targetCenter = getCenter(limitedTargetExtent);
		const sourceResolution = calculateSourceResolution(
			sourceProj, targetProj, targetCenter, targetResolution);

		if (!isFinite(sourceResolution) || sourceResolution <= 0) {
			// invalid sourceResolution -> EMPTY
			// probably edges of the projections when no extent is defined
			this.state = TileState.EMPTY;
			return;
		}

		const errorThresholdInPixels = opt_errorThreshold !== undefined ?
			opt_errorThreshold : ERROR_THRESHOLD;

		/**
		 * @private
		 * @type {!module:ol/reproj/Triangulation}
		 */
		this.triangulation_ = new Triangulation(
			sourceProj, targetProj, limitedTargetExtent, maxSourceExtent,
			sourceResolution * errorThresholdInPixels);

		if (this.triangulation_.getTriangles().length === 0) {
			// no valid triangles -> EMPTY
			this.state = TileState.EMPTY;
			return;
		}

		this.sourceZ_ = sourceTileGrid.getZForResolution(sourceResolution);
		let sourceExtent = this.triangulation_.calculateSourceExtent();

		if (maxSourceExtent) {
			if (sourceProj.canWrapX()) {
				sourceExtent[1] = clamp(
					sourceExtent[1], maxSourceExtent[1], maxSourceExtent[3]);
				sourceExtent[3] = clamp(
					sourceExtent[3], maxSourceExtent[1], maxSourceExtent[3]);
			} else {
				sourceExtent = getIntersection(sourceExtent, maxSourceExtent);
			}
		}

		if (!getArea(sourceExtent)) {
			this.state = TileState.EMPTY;
		} else {
			const sourceRange = sourceTileGrid.getTileRangeForExtentAndZ(
				sourceExtent, this.sourceZ_);

			for (let srcX = sourceRange.minX; srcX <= sourceRange.maxX; srcX++) {
				for (let srcY = sourceRange.minY; srcY <= sourceRange.maxY; srcY++) {
					const tile = getTileFunction(this.sourceZ_, srcX, srcY, pixelRatio);
					if (tile) {
						this.sourceTiles_.push(tile);
					}
				}
			}

			if (this.sourceTiles_.length === 0) {
				this.state = TileState.EMPTY;
			}
		}
	}

	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		if (this.state === TileState.LOADING) {
			this.unlistenSources_();
		}
		Tile.prototype.disposeInternal.call(this);
	}


	/**
	 * Get the HTML Canvas element for this tile.
	 * @return {HTMLCanvasElement} Canvas.
	 */
	public getImage() {
		return this.canvas_;
	}

	/**
	 * @inheritDoc
	 */
	public load() {
		if (this.state === TileState.IDLE) {
			this.state = TileState.LOADING;
			this.changed();

			let leftToLoad = 0;

			this.sourcesListenerKeys_ = [];
			this.sourceTiles_.forEach((tile) => {
				const state = tile.getState();
				if (state === TileState.IDLE || state === TileState.LOADING) {
					leftToLoad++;

					const sourceListenKey = listen(tile, EventType.CHANGE, () => {
						const tile_state = tile.getState();
						if (tile_state === TileState.LOADED ||
							tile_state === TileState.ERROR ||
							tile_state === TileState.EMPTY) {
							unlistenByKey(sourceListenKey!);
							leftToLoad--;
							if (leftToLoad === 0) {
								this.unlistenSources_();
								this.reproject_();
							}
						}
					}, this);
					this.sourcesListenerKeys_!.push(sourceListenKey!);
				}
			});

			this.sourceTiles_.forEach((tile) => {
				const state = tile.getState();
				if (state === TileState.IDLE) {
					tile.load();
				}
			});

			if (leftToLoad === 0) {
				setTimeout(this.reproject_.bind(this), 0);
			}
		}
	}


	/**
	 * @private
	 */
	private unlistenSources_() {
		this.sourcesListenerKeys_!.forEach(unlistenByKey);
		this.sourcesListenerKeys_ = null;
	}

	/**
	 * @private
	 */
	private reproject_() {
		const sources = [] as Array<{ extent: Extent; image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement; }>;
		this.sourceTiles_.forEach((tile) => {
			if (tile && tile.getState() === TileState.LOADED) {
				sources.push({
					extent: this.sourceTileGrid_.getTileCoordExtent(tile.tileCoord),
					image: tile.getImage()!
				});
			}
		});
		this.sourceTiles_.length = 0;

		if (sources.length === 0) {
			this.state = TileState.ERROR;
		} else {
			const z = this.wrappedTileCoord_[0];
			const size = this.targetTileGrid_.getTileSize(z);
			const width = typeof size === 'number' ? size : size[0];
			const height = typeof size === 'number' ? size : size[1];
			const targetResolution = this.targetTileGrid_.getResolution(z);
			const sourceResolution = this.sourceTileGrid_.getResolution(this.sourceZ_);

			const targetExtent = this.targetTileGrid_.getTileCoordExtent(
				this.wrappedTileCoord_);
			this.canvas_ = renderReprojected(width, height, this.pixelRatio_,
				sourceResolution, this.sourceTileGrid_.getExtent()!,
				targetResolution, targetExtent, this.triangulation_!, sources,
				this.gutter_, this.renderEdges_);

			this.state = TileState.LOADED;
		}
		this.changed();
	}
}
