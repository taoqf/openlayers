/**
 * @module ol/style/Atlas
 */
import { createCanvasContext2D } from '../dom';


/**
 * @typedef {Object} AtlasBlock
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

export interface AtlasBlock {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Provides information for an image inside an atlas.
 * `offsetX` and `offsetY` are the position of the image inside the atlas image `image`.
 * @typedef {Object} AtlasInfo
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {HTMLCanvasElement} image
 */

export interface AtlasInfo {
	offsetX: number;
	offsetY: number;
	image: HTMLCanvasElement;
}

/**
 * This class facilitates the creation of image atlases.
 *
 * Images added to an atlas will be rendered onto a single
 * atlas canvas. The distribution of images on the canvas is
 * managed with the bin packing algorithm described in:
 * http://www.blackpawn.com/texts/lightmaps/
 *
 * @constructor
 * @struct
 * @param {number} size The size in pixels of the sprite image.
 * @param {number} space The space in pixels between images.
 *    Because texture coordinates are float values, the edges of
 *    images might not be completely correct (in a way that the
 *    edges overlap when being rendered). To avoid this we add a
 *    padding around each image.
 */
export default class Atlas {
	private space: number;
	private emptyBlocks: AtlasBlock[];
	private entries: { [s: string]: AtlasInfo; };
	private context: CanvasRenderingContext2D;
	private canvas: HTMLCanvasElement;
	constructor(size: number, space: number) {

		/**
		 * @private
		 * @type {number}
		 */
		this.space = space;

		/**
		 * @private
		 * @type {Array.<module:ol/style/Atlas~AtlasBlock>}
		 */
		this.emptyBlocks = [{ x: 0, y: 0, width: size, height: size }];

		/**
		 * @private
		 * @type {Object.<string, module:ol/style/Atlas~AtlasInfo>}
		 */
		this.entries = {};

		/**
		 * @private
		 * @type {CanvasRenderingContext2D}
		 */
		this.context = createCanvasContext2D(size, size)!;

		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas = this.context.canvas;
	}


	/**
	 * @param {string} id The identifier of the entry to check.
	 * @return {?module:ol/style/Atlas~AtlasInfo} The atlas info.
	 */
	public get(id: string) {
		return this.entries[id] || null;
	}


	/**
	 * @param {string} id The identifier of the entry to add.
	 * @param {number} width The width.
	 * @param {number} height The height.
	 * @param {function(CanvasRenderingContext2D, number, number)} renderCallback
	 *    Called to render the new image onto an atlas image.
	 * @param {Object=} opt_this Value to use as `this` when executing
	 *    `renderCallback`.
	 * @return {?module:ol/style/Atlas~AtlasInfo} The position and atlas image for the entry.
	 */
	public add<T>(id: string, width: number, height: number, renderCallback: (this: T, context: CanvasRenderingContext2D, width: number, height: number) => void, opt_this?: T) {
		for (let i = 0, ii = this.emptyBlocks.length; i < ii; ++i) {
			const block = this.emptyBlocks[i];
			if (block.width >= width + this.space &&
				block.height >= height + this.space) {
				// we found a block that is big enough for our entry
				const entry = {
					image: this.canvas,
					offsetX: block.x + this.space,
					offsetY: block.y + this.space
				};
				this.entries[id] = entry;

				// render the image on the atlas image
				renderCallback.call(opt_this, this.context,
					block.x + this.space, block.y + this.space);

				// split the block after the insertion, either horizontally or vertically
				this.split_(i, block, width + this.space, height + this.space);

				return entry;
			}
		}

		// there is no space for the new entry in this atlas
		return null;
	}


	/**
	 * @private
	 * @param {number} index The index of the block.
	 * @param {module:ol/style/Atlas~AtlasBlock} block The block to split.
	 * @param {number} width The width of the entry to insert.
	 * @param {number} height The height of the entry to insert.
	 */
	private split_(index: number, block: AtlasBlock, width: number, height: number) {
		const deltaWidth = block.width - width;
		const deltaHeight = block.height - height;

		/** @type {module:ol/style/Atlas~AtlasBlock} */
		let newBlock1;
		/** @type {module:ol/style/Atlas~AtlasBlock} */
		let newBlock2;

		if (deltaWidth > deltaHeight) {
			// split vertically
			// block right of the inserted entry
			newBlock1 = {
				height: block.height,
				width: block.width - width,
				x: block.x + width,
				y: block.y
			};

			// block below the inserted entry
			newBlock2 = {
				height: block.height - height,
				width,
				x: block.x,
				y: block.y + height
			};
			this.updateBlocks_(index, newBlock1, newBlock2);
		} else {
			// split horizontally
			// block right of the inserted entry
			newBlock1 = {
				height,
				width: block.width - width,
				x: block.x + width,
				y: block.y
			};

			// block below the inserted entry
			newBlock2 = {
				height: block.height - height,
				width: block.width,
				x: block.x,
				y: block.y + height
			};
			this.updateBlocks_(index, newBlock1, newBlock2);
		}
	}


	/**
	 * Remove the old block and insert new blocks at the same array position.
	 * The new blocks are inserted at the same position, so that splitted
	 * blocks (that are potentially smaller) are filled first.
	 * @private
	 * @param {number} index The index of the block to remove.
	 * @param {module:ol/style/Atlas~AtlasBlock} newBlock1 The 1st block to add.
	 * @param {module:ol/style/Atlas~AtlasBlock} newBlock2 The 2nd block to add.
	 */
	private updateBlocks_(index: number, newBlock1: AtlasBlock, newBlock2: AtlasBlock) {
		const args = [] as AtlasBlock[];
		if (newBlock1.width > 0 && newBlock1.height > 0) {
			args.push(newBlock1);
		}
		if (newBlock2.width > 0 && newBlock2.height > 0) {
			args.push(newBlock2);
		}
		this.emptyBlocks.splice(index, 1, ...args);
	}
}
