/**
 * @module ol/dom
 */


/**
 * Create an html canvas element and returns its 2d context.
 * @param {number=} opt_width Canvas width.
 * @param {number=} opt_height Canvas height.
 * @return {CanvasRenderingContext2D} The context.
 */
export function createCanvasContext2D(opt_width: number, opt_height: number) {
	const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
	if (opt_width) {
		canvas.width = opt_width;
	}
	if (opt_height) {
		canvas.height = opt_height;
	}
	return /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
}


/**
 * Get the current computed width for the given element including margin,
 * padding and border.
 * Equivalent to jQuery's `$(el).outerWidth(true)`.
 * @param {!Element} element Element.
 * @return {number} The width.
 */
export function outerWidth(element: HTMLElement) {
	let width = element.offsetWidth;
	const style = getComputedStyle(element);
	width += parseInt(style.marginLeft as string, 10) + parseInt(style.marginRight as string, 10);

	return width;
}


/**
 * Get the current computed height for the given element including margin,
 * padding and border.
 * Equivalent to jQuery's `$(el).outerHeight(true)`.
 * @param {!Element} element Element.
 * @return {number} The height.
 */
export function outerHeight(element: HTMLElement) {
	let height = element.offsetHeight;
	const style = getComputedStyle(element);
	height += parseInt(style.marginTop as string, 10) + parseInt(style.marginBottom as string, 10);

	return height;
}

/**
 * @param {Node} newNode Node to replace old node
 * @param {Node} oldNode The node to be replaced
 */
export function replaceNode(newNode: Node, oldNode: Node) {
	const parent = oldNode.parentNode;
	if (parent) {
		parent.replaceChild(newNode, oldNode);
	}
}

/**
 * @param {Node} node The node to remove.
 * @returns {Node} The node that was removed or null.
 */
export function removeNode(node: Node) {
	return node && node.parentNode ? node.parentNode.removeChild(node) : null;
}

/**
 * @param {Node} node The node to remove the children from.
 */
export function removeChildren(node: Node) {
	while (node.lastChild) {
		node.removeChild(node.lastChild);
	}
}
