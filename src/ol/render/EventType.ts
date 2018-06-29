/**
 * @module ol/render/EventType
 */

/**
 * @enum {string}
 */
enum EventType {
	/**
	 * @event module:ol/render/Event~RenderEvent#postcompose
	 * @api
	 */
	POSTCOMPOSE = 'postcompose',
	/**
	 * @event module:ol/render/Event~RenderEvent#precompose
	 * @api
	 */
	PRECOMPOSE = 'precompose',
	/**
	 * @event module:ol/render/Event~RenderEvent#render
	 * @api
	 */
	RENDER = 'render'
}

export default EventType;
