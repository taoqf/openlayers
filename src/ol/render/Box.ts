/**
 * @module ol/render/Box
 */
// FIXME add rotation

import { Coordinate } from '../coordinate';
import Disposable from '../Disposable';
import Polygon from '../geom/Polygon';
import { Pixel } from '../index';
import PluggableMap from '../PluggableMap';

/**
 * @constructor
 * @extends {module:ol/Disposable}
 * @param {string} className CSS class name.
 */
export default class RenderBox extends Disposable {
	private geometry_: Polygon | null;
	private element_: HTMLDivElement;
	private map_: PluggableMap | null;
	private startPixel_: Pixel | null;
	private endPixel_: Pixel | null;
	constructor(className: string) {
		super();
		/**
		 * @type {module:ol/geom/Polygon}
		 * @private
		 */
		this.geometry_ = null;

		/**
		 * @type {HTMLDivElement}
		 * @private
		 */
		this.element_ = /** @type {HTMLDivElement} */ (document.createElement('div'));
		this.element_.style.position = 'absolute';
		this.element_.className = 'ol-box ' + className;

		/**
		 * @private
		 * @type {module:ol/PluggableMap}
		 */
		this.map_ = null;

		/**
		 * @private
		 * @type {module:ol~Pixel}
		 */
		this.startPixel_ = null;

		/**
		 * @private
		 * @type {module:ol~Pixel}
		 */
		this.endPixel_ = null;

	}

	/**
	 * @inheritDoc
	 */
	public disposeInternal() {
		this.setMap(null);
	}


	/**
	 * @param {module:ol/PluggableMap} map Map.
	 */
	public setMap(map: PluggableMap | null) {
		if (this.map_) {
			this.map_.getOverlayContainer().removeChild(this.element_);
			const style = this.element_.style;
			style.left = style.top = style.width = style.height = 'inherit';
		}
		this.map_ = map;
		if (this.map_) {
			this.map_.getOverlayContainer().appendChild(this.element_);
		}
	}


	/**
	 * @param {module:ol~Pixel} startPixel Start pixel.
	 * @param {module:ol~Pixel} endPixel End pixel.
	 */
	public setPixels(startPixel: Pixel, endPixel: Pixel) {
		this.startPixel_ = startPixel;
		this.endPixel_ = endPixel;
		this.createOrUpdateGeometry();
		this.render_();
	}


	/**
	 * Creates or updates the cached geometry.
	 */
	public createOrUpdateGeometry() {
		const startPixel = this.startPixel_!;
		const endPixel = this.endPixel_!;
		const pixels = [
			startPixel,
			[startPixel[0], endPixel[1]],
			endPixel,
			[endPixel[0], startPixel[1]]
		] as Pixel[];
		const coordinates = pixels.map((pixel) => {
			return this.map_!.getCoordinateFromPixel(pixel)!;
		});
		// close the polygon
		coordinates[4] = coordinates[0].slice() as Coordinate;
		if (!this.geometry_) {
			this.geometry_ = new Polygon([coordinates]);
		} else {
			this.geometry_.setCoordinates([coordinates]);
		}
	}


	/**
	 * @return {module:ol/geom/Polygon} Geometry.
	 */
	public getGeometry() {
		return this.geometry_;
	}

	/**
	 * @private
	 */
	private render_() {
		const startPixel = this.startPixel_!;
		const endPixel = this.endPixel_!;
		const px = 'px';
		const style = this.element_.style;
		style.left = Math.min(startPixel[0], endPixel[0]) + px;
		style.top = Math.min(startPixel[1], endPixel[1]) + px;
		style.width = Math.abs(endPixel[0] - startPixel[0]) + px;
		style.height = Math.abs(endPixel[1] - startPixel[1]) + px;
	}
}
