/**
 * @module ol/style/AtlasManager
 */
import { UNDEFINED } from '../functions';
import { WEBGL_MAX_TEXTURE_SIZE } from '../index';
import Atlas, { AtlasInfo } from '../style/Atlas';

/**
 * @typedef {Object} Options
 * @property {number} [initialSize=256] The size in pixels of the first atlas image.
 * @property {number} [maxSize] The maximum size in pixels of atlas images. Default is
 * `WEBGL_MAX_TEXTURE_SIZE` or 2048 if WebGL is not supported.
 * @property {number} [space=1] The space in pixels between images.
 */

export interface Options {
	initialSize: number;
	maxSize: number;
	space: number;
}

/**
 * Provides information for an image inside an atlas manager.
 * `offsetX` and `offsetY` is the position of the image inside
 * the atlas image `image` and the position of the hit-detection image
 * inside the hit-detection atlas image `hitImage`.
 * @typedef {Object} AtlasManagerInfo
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {HTMLCanvasElement} image
 * @property {HTMLCanvasElement} hitImage
 */


/**
 * The size in pixels of the first atlas image.
 * @type {number}
 */
const INITIAL_ATLAS_SIZE = 256;

/**
 * The maximum size in pixels of atlas images.
 * @type {number}
 */
const MAX_ATLAS_SIZE = -1;


/**
 * Manages the creation of image atlases.
 *
 * Images added to this manager will be inserted into an atlas, which
 * will be used for rendering.
 * The `size` given in the constructor is the size for the first
 * atlas. After that, when new atlases are created, they will have
 * twice the size as the latest atlas (until `maxSize` is reached).
 *
 * If an application uses many images or very large images, it is recommended
 * to set a higher `size` value to avoid the creation of too many atlases.
 *
 * @constructor
 * @struct
 * @api
 * @param {module:ol/style/AtlasManager~Options=} opt_options Options.
 */
export default class AtlasManager {
	private currentSize: number;
	private maxSize: number;
	private space: number;
	private atlases: Atlas[];
	private currentHitSize: any;
	private hitAtlases: Atlas[];
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options || {};

		/**
		 * The size in pixels of the latest atlas image.
		 * @private
		 * @type {number}
		 */
		this.currentSize = options.initialSize !== undefined ?
			options.initialSize : INITIAL_ATLAS_SIZE;

		/**
		 * The maximum size in pixels of atlas images.
		 * @private
		 * @type {number}
		 */
		this.maxSize = options.maxSize !== undefined ?
			options.maxSize : MAX_ATLAS_SIZE !== -1 ?
				MAX_ATLAS_SIZE : WEBGL_MAX_TEXTURE_SIZE !== undefined ?
					WEBGL_MAX_TEXTURE_SIZE : 2048;

		/**
		 * The size in pixels between images.
		 * @private
		 * @type {number}
		 */
		this.space = options.space !== undefined ? options.space : 1;

		/**
		 * @private
		 * @type {Array.<module:ol/style/Atlas>}
		 */
		this.atlases = [new Atlas(this.currentSize, this.space)];

		/**
		 * The size in pixels of the latest atlas image for hit-detection images.
		 * @private
		 * @type {number}
		 */
		this.currentHitSize = this.currentSize;

		/**
		 * @private
		 * @type {Array.<module:ol/style/Atlas>}
		 */
		this.hitAtlases = [new Atlas(this.currentHitSize, this.space)];
	}


	/**
	 * @param {string} id The identifier of the entry to check.
	 * @return {?module:ol/style/AtlasManager~AtlasManagerInfo} The position and atlas image for the
	 *    entry, or `null` if the entry is not part of the atlas manager.
	 */
	public getInfo(id: string) {
		/** @type {?module:ol/style/Atlas~AtlasInfo} */
		const info = this.getInfo_(this.atlases, id);

		if (!info) {
			return null;
		}
		const hitInfo = /** @type {module:ol/style/Atlas~AtlasInfo} */ (this.getInfo_(this.hitAtlases, id))!;

		return this.mergeInfos_(info, hitInfo);
	}

	/**
	 * Add an image to the atlas manager.
	 *
	 * If an entry for the given id already exists, the entry will
	 * be overridden (but the space on the atlas graphic will not be freed).
	 *
	 * If `renderHitCallback` is provided, the image (or the hit-detection version
	 * of the image) will be rendered into a separate hit-detection atlas image.
	 *
	 * @param {string} id The identifier of the entry to add.
	 * @param {number} width The width.
	 * @param {number} height The height.
	 * @param {function(CanvasRenderingContext2D, number, number)} renderCallback
	 *    Called to render the new image onto an atlas image.
	 * @param {function(CanvasRenderingContext2D, number, number)=}
	 *    opt_renderHitCallback Called to render a hit-detection image onto a hit
	 *    detection atlas image.
	 * @param {Object=} opt_this Value to use as `this` when executing
	 *    `renderCallback` and `renderHitCallback`.
	 * @return {?module:ol/style/AtlasManager~AtlasManagerInfo}  The position and atlas image for the
	 *    entry, or `null` if the image is too big.
	 */
	public add<T>(id: string, width: number, height: number, renderCallback: (this: T, context: CanvasRenderingContext2D, width: number, height: number) => void, opt_renderHitCallback?: (this: T, context: CanvasRenderingContext2D, width: number, height: number) => void, opt_this?: T) {
		if (width + this.space > this.maxSize ||
			height + this.space > this.maxSize) {
			return null;
		}

		/** @type {?module:ol/style/Atlas~AtlasInfo} */
		const info = this.add_(false, id, width, height, renderCallback, opt_this);
		if (!info) {
			return null;
		}

		// even if no hit-detection entry is requested, we insert a fake entry into
		// the hit-detection atlas, to make sure that the offset is the same for
		// the original image and the hit-detection image.
		const renderHitCallback = opt_renderHitCallback !== undefined ?
			opt_renderHitCallback : UNDEFINED;

		const hitInfo = /** @type {module:ol/style/Atlas~AtlasInfo} */ (this.add_(true,
			id, width, height, renderHitCallback, opt_this))!;

		return this.mergeInfos_(info, hitInfo);
	}

	/**
	 * @private
	 * @param {boolean} isHitAtlas If the hit-detection atlases are used.
	 * @param {string} id The identifier of the entry to add.
	 * @param {number} width The width.
	 * @param {number} height The height.
	 * @param {function(CanvasRenderingContext2D, number, number)} renderCallback
	 *    Called to render the new image onto an atlas image.
	 * @param {Object=} opt_this Value to use as `this` when executing
	 *    `renderCallback` and `renderHitCallback`.
	 * @return {?module:ol/style/Atlas~AtlasInfo}  The position and atlas image for the entry,
	 *    or `null` if the image is too big.
	 */
	private add_<T>(isHitAtlas: boolean, id: string, width: number, height: number, renderCallback: (this: T, context: CanvasRenderingContext2D, width: number, height: number) => void, opt_this?: T) {
		const atlases = (isHitAtlas) ? this.hitAtlases : this.atlases;
		for (let i = 0, ii = atlases.length; i < ii; ++i) {
			const atlas = atlases[i];
			const info = atlas.add(id, width, height, renderCallback, opt_this);
			if (info) {
				return info;
			} else if (!info && i === ii - 1) {
				// the entry could not be added to one of the existing atlases,
				// create a new atlas that is twice as big and try to add to this one.
				let size;
				if (isHitAtlas) {
					size = Math.min(this.currentHitSize * 2, this.maxSize);
					this.currentHitSize = size;
				} else {
					size = Math.min(this.currentSize * 2, this.maxSize);
					this.currentSize = size;
				}
				atlases.push(new Atlas(size, this.space));
				// run the loop another time
				++ii;
			}
		}
		return null;
	}


	/**
	 * @private
	 * @param {Array.<module:ol/style/Atlas>} atlases The atlases to search.
	 * @param {string} id The identifier of the entry to check.
	 * @return {?module:ol/style/Atlas~AtlasInfo} The position and atlas image for the entry,
	 *    or `null` if the entry is not part of the atlases.
	 */
	private getInfo_(atlases: Atlas[], id: string) {
		for (let i = 0, ii = atlases.length; i < ii; ++i) {
			const atlas = atlases[i];
			const info = atlas.get(id);
			if (info) {
				return info;
			}
		}
		return null;
	}

	/**
	 * @private
	 * @param {module:ol/style/Atlas~AtlasInfo} info The info for the real image.
	 * @param {module:ol/style/Atlas~AtlasInfo} hitInfo The info for the hit-detection
	 *    image.
	 * @return {?module:ol/style/AtlasManager~AtlasManagerInfo} The position and atlas image for the
	 *    entry, or `null` if the entry is not part of the atlases.
	 */
	private mergeInfos_(info: AtlasInfo, hitInfo: AtlasInfo) {
		return (
	/** @type {module:ol/style/AtlasManager~AtlasManagerInfo} */ ({
				hitImage: hitInfo.image,
				image: info.image,
				offsetX: info.offsetX,
				offsetY: info.offsetY
			})
		);
	}
}
