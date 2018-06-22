/**
 * @module ol/Disposable
 */
export default class Disposable {
	/**
	 * The object has already been disposed.
	 * @type {boolean}
	 * @private
	 */
	private disposed = false;

	/**
	 * Clean up.
	 */
	public dispose() {
		if (!this.disposed) {
			this.disposed = true;
			this.disposeInternal();
		}
	}
	/**
	 * Extension point for disposable objects.
	 * @protected
	 */
	public disposeInternal() { }
}
