/**
 * @module ol/TileRange
 */
/**
 * A representation of a contiguous block of tiles.  A tile range is specified
 * by its min/max tile coordinates and is inclusive of coordinates.
 */
export default class TileRange {
	public minX: number;
	public maxX: number;
	public minY: number;
	public maxY: number;
	/**
	 * @param minX Minimum X.
	 * @param maxX Maximum X.
	 * @param minY Minimum Y.
	 * @param maxY Maximum Y.
	 * @struct
	 */
	constructor(minX: number, maxX: number, minY: number, maxY: number) {
		this.minX = minX;

		this.maxX = maxX;

		this.minY = minY;

		this.maxY = maxY;
	}

	/**
	 * @param {module:ol/tilecoord~TileCoord} tileCoord Tile coordinate.
	 * @return {boolean} Contains tile coordinate.
	 */
	public contains(tileCoord: import('./tilecoord').TileCoord) {
		return this.containsXY(tileCoord[1], tileCoord[2]);
	}


	/**
	 * @param {module:ol/TileRange} tileRange Tile range.
	 * @return {boolean} Contains.
	 */
	public containsTileRange(tileRange: TileRange) {
		return this.minX <= tileRange.minX && tileRange.maxX <= this.maxX &&
			this.minY <= tileRange.minY && tileRange.maxY <= this.maxY;
	}


	/**
	 * @param {number} x Tile coordinate x.
	 * @param {number} y Tile coordinate y.
	 * @return {boolean} Contains coordinate.
	 */
	public containsXY(x: number, y: number) {
		return this.minX <= x && x <= this.maxX && this.minY <= y && y <= this.maxY;
	}


	/**
	 * @param {module:ol/TileRange} tileRange Tile range.
	 * @return {boolean} Equals.
	 */
	public equals(tileRange: TileRange) {
		return this.minX === tileRange.minX && this.minY === tileRange.minY &&
			this.maxX === tileRange.maxX && this.maxY === tileRange.maxY;
	}


	/**
	 * @param {module:ol/TileRange} tileRange Tile range.
	 */
	public extend(tileRange: TileRange) {
		if (tileRange.minX < this.minX) {
			this.minX = tileRange.minX;
		}
		if (tileRange.maxX > this.maxX) {
			this.maxX = tileRange.maxX;
		}
		if (tileRange.minY < this.minY) {
			this.minY = tileRange.minY;
		}
		if (tileRange.maxY > this.maxY) {
			this.maxY = tileRange.maxY;
		}
	}


	/**
	 * @return {number} Height.
	 */
	public getHeight() {
		return this.maxY - this.minY + 1;
	}


	/**
	 * @return {module:ol/size~Size} Size.
	 */
	public getSize() {
		return [this.getWidth(), this.getHeight()];
	}


	/**
	 * @return {number} Width.
	 */
	public getWidth() {
		return this.maxX - this.minX + 1;
	}


	/**
	 * @param {module:ol/TileRange} tileRange Tile range.
	 * @return {boolean} Intersects.
	 */
	public intersects(tileRange: TileRange) {
		return this.minX <= tileRange.maxX &&
			this.maxX >= tileRange.minX &&
			this.minY <= tileRange.maxY &&
			this.maxY >= tileRange.minY;
	}
}


/**
 * @param minX Minimum X.
 * @param maxX Maximum X.
 * @param minY Minimum Y.
 * @param maxY Maximum Y.
 * @param tileRange TileRange.
 * @return Tile range.
 */
export function createOrUpdate(minX: number, maxX: number, minY: number, maxY: number, tileRange?: TileRange) {
	if (tileRange !== undefined) {
		tileRange.minX = minX;
		tileRange.maxX = maxX;
		tileRange.minY = minY;
		tileRange.maxY = maxY;
		return tileRange;
	} else {
		return new TileRange(minX, maxX, minY, maxY);
	}
}
