/**
 * @module ol/TileQueue
 */
import { Coordinate } from './coordinate';
import { listen, unlisten } from './events';
import Event from './events/Event';
import EventType from './events/EventType';
import PriorityQueue from './structs/PriorityQueue';
import Tile from './Tile';
import TileState from './TileState';


/**
 * @typedef {function(module:ol/Tile, string, module:ol/coordinate~Coordinate, number): number} PriorityFunction
 */

export type PriorityFunction = (tile: Tile, s: string, coordinate: Coordinate, n: number) => number;

/**
 * @constructor
 * @extends {module:ol/structs/PriorityQueue.<Array>}
 * @param {module:ol/TileQueue~PriorityFunction} tilePriorityFunction
 *     Tile priority function.
 * @param {function(): ?} tileChangeCallback
 *     Function called on each tile change event.
 * @struct
 */
export default class TileQueue extends PriorityQueue<[Tile, string, Coordinate, number]> {
	private tileChangeCallback_: () => void;
	private tilesLoading_: number;
	private tilesLoadingKeys_: { [key: string]: boolean; };
	constructor(tilePriorityFunction: PriorityFunction, tileChangeCallback?: () => void) {
		super(
			/**
			 * @param {Array} element Element.
			 * @return {number} Priority.
			 */
			(element) => {
				return tilePriorityFunction(element[0], element[1], element[2], element[3]);
			},
			/**
			 * @param {Array} element Element.
			 * @return {string} Key.
			 */
			(element) => {
				return (/** @type {module:ol/Tile} */ (element[0]).getKey());
			});

		/**
		 * @private
		 * @type {function(): ?}
		 */
		this.tileChangeCallback_ = tileChangeCallback!;

		/**
		 * @private
		 * @type {number}
		 */
		this.tilesLoading_ = 0;

		/**
		 * @private
		 * @type {!Object.<string,boolean>}
		 */
		this.tilesLoadingKeys_ = {};

	}


	/**
	 * @inheritDoc
	 */
	public enqueue(element: [Tile, string, Coordinate, number]) {
		const added = PriorityQueue.prototype.enqueue.call(this, element);
		if (added) {
			const tile = element[0];
			listen(tile, EventType.CHANGE, this.handleTileChange, this);
		}
		return added;
	}


	/**
	 * @return {number} Number of tiles loading.
	 */
	public getTilesLoading() {
		return this.tilesLoading_;
	}


	/**
	 * @param {module:ol/events/Event} event Event.
	 * @protected
	 */
	public handleTileChange(event: Event) {
		const tile = /** @type {module:ol/Tile} */ (event.target);
		const state = tile.getState();
		if (state === TileState.LOADED || state === TileState.ERROR ||
			state === TileState.EMPTY || state === TileState.ABORT) {
			unlisten(tile, EventType.CHANGE, this.handleTileChange, this);
			const tileKey = tile.getKey();
			if (tileKey in this.tilesLoadingKeys_) {
				delete this.tilesLoadingKeys_[tileKey];
				--this.tilesLoading_;
			}
			this.tileChangeCallback_();
		}
	}


	/**
	 * @param {number} maxTotalLoading Maximum number tiles to load simultaneously.
	 * @param {number} maxNewLoads Maximum number of new tiles to load.
	 */
	public loadMoreTiles(maxTotalLoading: number, maxNewLoads: number) {
		let newLoads = 0;
		let abortedTiles = false;
		while (this.tilesLoading_ < maxTotalLoading && newLoads < maxNewLoads &&
			this.getCount() > 0) {
			const tile = /** @type {module:ol/Tile} */ (this.dequeue()[0]);
			const tileKey = tile.getKey();
			const state = tile.getState();
			if (state === TileState.ABORT) {
				abortedTiles = true;
			} else if (state === TileState.IDLE && !(tileKey in this.tilesLoadingKeys_)) {
				this.tilesLoadingKeys_[tileKey] = true;
				++this.tilesLoading_;
				++newLoads;
				tile.load();
			}
		}
		if (newLoads === 0 && abortedTiles) {
			// Do not stop the render loop when all wanted tiles were aborted due to
			// a small, saturated tile cache.
			this.tileChangeCallback_();
		}
	}
}
