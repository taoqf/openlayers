/**
 * @module ol/style/IconImageCache
 */
import { asString, Color } from '../color';
import IconImage from './IconImage';

/**
 * @param {string} src Src.
 * @param {?string} crossOrigin Cross origin.
 * @param {module:ol/color~Color} color Color.
 * @return {string} Cache key.
 */
function getKey(src: string, crossOrigin: string, color: Color) {
	const colorString = color ? asString(color) : 'null';
	return crossOrigin + ':' + src + ':' + colorString;
}

/**
 * Singleton class. Available through {@link module:ol/style/IconImageCache~shared}.
 * @constructor
 */
export default class IconImageCache {

	/**
	 * @type {!Object.<string, module:ol/style/IconImage>}
	 * @private
	 */
	private cache_ = {} as { [key: string]: IconImage };

	/**
	 * @type {number}
	 * @private
	 */
	private cacheSize_ = 0;

	/**
	 * @type {number}
	 * @private
	 */
	private maxCacheSize_ = 32;

	/**
	 * FIXME empty description for jsdoc
	 */
	public clear() {
		this.cache_ = {};
		this.cacheSize_ = 0;
	}


	/**
	 * FIXME empty description for jsdoc
	 */
	public expire() {
		if (this.cacheSize_ > this.maxCacheSize_) {
			let i = 0;
			Object.keys(this.cache_).forEach((key) => {
				const iconImage = this.cache_[key];
				if ((i++ & 3) === 0 && !iconImage.hasListener()) {
					delete this.cache_[key];
					--this.cacheSize_;
				}
			});
		}
	}


	/**
	 * @param {string} src Src.
	 * @param {?string} crossOrigin Cross origin.
	 * @param {module:ol/color~Color} color Color.
	 * @return {module:ol/style/IconImage} Icon image.
	 */
	public get(src: string, crossOrigin: string, color: Color) {
		const key = getKey(src, crossOrigin, color);
		return key in this.cache_ ? this.cache_[key] : null;
	}


	/**
	 * @param {string} src Src.
	 * @param {?string} crossOrigin Cross origin.
	 * @param {module:ol/color~Color} color Color.
	 * @param {module:ol/style/IconImage} iconImage Icon image.
	 */
	public set(src: string, crossOrigin: string, color: Color, iconImage: IconImage) {
		const key = getKey(src, crossOrigin, color);
		this.cache_[key] = iconImage;
		++this.cacheSize_;
	}


	/**
	 * Set the cache size of the icon cache. Default is `32`. Change this value when
	 * your map uses more than 32 different icon images and you are not caching icon
	 * styles on the application level.
	 * @param {number} maxCacheSize Cache max size.
	 * @api
	 */
	public setSize(maxCacheSize: number) {
		this.maxCacheSize_ = maxCacheSize;
		this.expire();
	}

	/**
	 * The {@link module:ol/style/IconImageCache~IconImageCache} for
	 * {@link module:ol/style/Icon~Icon} images.
	 * @api
	 */
}
