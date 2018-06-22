/**
 * @module ol/source/State
 */

/**
 * State of the source, one of 'undefined', 'loading', 'ready' or 'error'.
 * @enum {string}
 */
enum SourceState {
	UNDEFINED = 'undefined',
	LOADING = 'loading',
	READY = 'ready',
	ERROR = 'error'
}
export default SourceState;
