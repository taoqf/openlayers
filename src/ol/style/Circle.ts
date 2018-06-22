/**
 * @module ol/style/Circle
 */
import RegularShape from '../style/RegularShape';
import AtlasManager from './AtlasManager';
import Fill from './Fill';
import Stroke from './Stroke';

/**
 * @typedef {Object} Options
 * @property {module:ol/style/Fill} [fill] Fill style.
 * @property {number} radius Circle radius.
 * @property {boolean} [snapToPixel=true] If `true` integral numbers of pixels are used as the X and Y pixel coordinate
 * when drawing the circle in the output canvas. If `false` fractional numbers may be used. Using `true` allows for
 * "sharp" rendering (no blur), while using `false` allows for "accurate" rendering. Note that accuracy is important if
 * the circle's position is animated. Without it, the circle may jitter noticeably.
 * @property {module:ol/style/Stroke} [stroke] Stroke style.
 * @property {module:ol/style/AtlasManager} [atlasManager] The atlas manager to use for this circle.
 * When using WebGL it is recommended to use an atlas manager to avoid texture switching. If an atlas manager is given,
 * the circle is added to an atlas. By default no atlas manager is used.
 */

export interface Options {
	fill: Fill;
	radius: number;
	snapToPixel: boolean;
	stroke: Stroke;
	atlasManager: AtlasManager;
}

/**
 * @classdesc
 * Set circle style for vector features.
 *
 * @constructor
 * @param {module:ol/style/Circle~Options=} opt_options Options.
 * @extends {module:ol/style/RegularShape}
 * @api
 */
export default class CircleStyle extends RegularShape {
	public atlasManager: AtlasManager | undefined;
	public radius: number | undefined;
	constructor(opt_options?: Partial<Options>) {

		const options = opt_options || {};

		super({
			atlasManager: options.atlasManager,
			fill: options.fill,
			points: Infinity,
			radius: options.radius,
			snapToPixel: options.snapToPixel,
			stroke: options.stroke
		});
		this.atlasManager = options.atlasManager;
		this.radius = options.radius;
	}

	/**
	 * Clones the style.  If an atlasmanager was provided to the original style it will be used in the cloned style, too.
	 * @return {module:ol/style/Circle} The cloned style.
	 * @override
	 * @api
	 */
	public clone() {
		const style = new CircleStyle({
			atlasManager: this.atlasManager,
			fill: this.getFill() ? this.getFill()!.clone() : undefined,
			radius: this.getRadius(),
			snapToPixel: this.getSnapToPixel(),
			stroke: this.getStroke() ? this.getStroke()!.clone() : undefined
		});
		style.setOpacity(this.getOpacity());
		style.setScale(this.getScale());
		return style;
	}


	/**
	 * Set the circle radius.
	 *
	 * @param {number} radius Circle radius.
	 * @api
	 */
	public setRadius(radius: number) {
		this.radius = radius;
		this.render_(this.atlasManager);
	}
}
