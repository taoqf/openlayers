import ReplayType from './ReplayType';
import VectorContext from './VectorContext';

/**
 * @module ol/render/ReplayGroup
 */
/**
 * Base class for replay groups.
 * @constructor
 * @abstract
 */
export default abstract class ReplayGroup {

	/**
	 * @abstract
	 * @param {number|undefined} zIndex Z index.
	 * @param {module:ol/render/ReplayType} replayType Replay type.
	 * @return {module:ol/render/VectorContext} Replay.
	 */
	public abstract getReplay(zIndex: number | undefined, replayType: ReplayType): VectorContext;


	/**
	 * @abstract
	 * @return {boolean} Is empty.
	 */
	public abstract isEmpty(): boolean;
}
