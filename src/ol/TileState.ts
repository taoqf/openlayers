/**
 * @module ol/TileState
 */

/**
 * @enum {number}
 */
enum TileState {
	ABORT = 5,
	EMPTY = 4,
	ERROR = 3,
	IDLE = 0,
	LOADED = 2,
	LOADING = 1
}

export default TileState;
