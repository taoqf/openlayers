/**
 * @module ol/Kinetic
 */

/**
 * Implementation of inertial deceleration for map movement.
 */
export default class Kinetic {
	private decay: number;
	private minVelocity: number;
	private delay: number;
	private points = [] as number[];
	private angle = 0;
	private initialVelocity = 0;
	/**
	 * @param decay Rate of decay (must be negative).
	 * @param minVelocity Minimum velocity (pixels/millisecond).
	 * @param delay Delay to consider to calculate the kinetic
	 *     initial values (milliseconds).
	 */
	constructor(decay: number, minVelocity: number, delay: number) {
		this.decay = decay;
		this.minVelocity = minVelocity;
		this.delay = delay;
	}
	public begin() {
		this.points.length = 0;
		this.angle = 0;
		this.initialVelocity = 0;
	}
	public update(x: number, y: number) {
		this.points.push(x, y, Date.now());
	}
	/**
	 * @return Whether we should do kinetic animation.
	 */
	public end() {
		if (this.points.length < 6) {
			// at least 2 points are required (i.e. there must be at least 6 elements
			// in the array)
			return false;
		}
		const delay = Date.now() - this.delay;
		const lastIndex = this.points.length - 3;
		if (this.points[lastIndex + 2] < delay) {
			// the last tracked point is too old, which means that the user stopped
			// panning before releasing the map
			return false;
		}

		// get the first point which still falls into the delay time
		let firstIndex = lastIndex - 3;
		while (firstIndex > 0 && this.points[firstIndex + 2] > delay) {
			firstIndex -= 3;
		}

		const duration = this.points[lastIndex + 2] - this.points[firstIndex + 2];
		// we don't want a duration of 0 (divide by zero)
		// we also make sure the user panned for a duration of at least one frame
		// (1/60s) to compute sane displacement values
		if (duration < 1000 / 60) {
			return false;
		}

		const dx = this.points[lastIndex] - this.points[firstIndex];
		const dy = this.points[lastIndex + 1] - this.points[firstIndex + 1];
		this.angle = Math.atan2(dy, dx);
		this.initialVelocity = Math.sqrt(dx * dx + dy * dy) / duration;
		return this.initialVelocity > this.minVelocity;
	}
	/**
	 * @return Total distance travelled (pixels).
	 */
	public getDistance() {
		return (this.minVelocity - this.initialVelocity) / this.decay;
	}
	/**
	 * @return Angle of the kinetic panning animation (radians).
	 */
	public getAngle() {
		return this.angle;
	}
}
