/**
 * @module ol/TileCache
 */
import LRUCache from './structs/LRUCache';
import Tile from './Tile';
import { fromKey, getKey } from './tilecoord';
import TileRange from './TileRange';

/**
 * @constructor
 * @extends {module:ol/structs/LRUCache.<module:ol/Tile>}
 * @param {number=} opt_highWaterMark High water mark.
 * @struct
 */
export default class TileCache extends LRUCache<Tile> {
	constructor(opt_highWaterMark?: number) {
		super(opt_highWaterMark);
	}

	/**
	 * @param {!Object.<string, module:ol/TileRange>} usedTiles Used tiles.
	 */
	public expireCache(usedTiles: { [tile: string]: TileRange; }) {
		while (this.canExpireCache()) {
			const tile = this.peekLast();
			const zKey = tile.tileCoord[0].toString();
			if (zKey in usedTiles && usedTiles[zKey].contains(tile.tileCoord)) {
				break;
			} else {
				this.pop().dispose();
			}
		}
	}

	/**
	 * Prune all tiles from the cache that don't have the same z as the newest tile.
	 */
	public pruneExceptNewestZ() {
		if (this.getCount() === 0) {
			return;
		}
		const key = this.peekFirstKey();
		const tileCoord = fromKey(key);
		const z = tileCoord[0];
		this.forEach((tile) => {
			if (tile.tileCoord[0] !== z) {
				this.remove(getKey(tile.tileCoord));
				tile.dispose();
			}
		}, this);
	}
}
