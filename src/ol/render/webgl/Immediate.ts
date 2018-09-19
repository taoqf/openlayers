/**
 * @module ol/render/webgl/Immediate
 */
import { Coordinate } from '../../coordinate';
import { Extent, intersects } from '../../extent';
import Feature from '../../Feature';
import Circle from '../../geom/Circle';
import Geometry from '../../geom/Geometry';
import GeometryCollection from '../../geom/GeometryCollection';
import GeometryType from '../../geom/GeometryType';
import LineString from '../../geom/LineString';
import MultiLineString from '../../geom/MultiLineString';
import MultiPoint from '../../geom/MultiPoint';
import MultiPolygon from '../../geom/MultiPolygon';
import Point from '../../geom/Point';
import Polygon from '../../geom/Polygon';
import SimpleGeometry from '../../geom/SimpleGeometry';
import { Size } from '../../size';
import { Fill, Image } from '../../style';
import Stroke from '../../style/Stroke';
import Style from '../../style/Style';
import Text from '../../style/Text';
import WebGLContext from '../../webgl/Context';
import RenderFeature from '../Feature';
import ReplayGroup from '../ReplayGroup';
import ReplayType from '../ReplayType';
import VectorContext from '../VectorContext';
import WebGLReplayGroup from '../webgl/ReplayGroup';
import WebGLTextReplay from './TextReplay';

/**
 * @constructor
 * @extends {module:ol/render/VectorContext}
 * @param {module:ol/webgl/Context} context Context.
 * @param {module:ol/coordinate~Coordinate} center Center.
 * @param {number} resolution Resolution.
 * @param {number} rotation Rotation.
 * @param {module:ol/size~Size} size Size.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {number} pixelRatio Pixel ratio.
 * @struct
 */
export default class WebGLImmediateRenderer extends VectorContext {
	private context_: WebGLContext;
	private center_: Coordinate;
	private extent_: Extent;
	private pixelRatio_: number;
	private size_: Size;
	private rotation_: number;
	private resolution_: number;
	private imageStyle_: any;
	private fillStyle_: any;
	private strokeStyle_: Stroke | null;
	private textStyle_: any;
	constructor(context: WebGLContext, center: Coordinate, resolution: number, rotation: number, size: Size, extent: Extent, pixelRatio: number) {
		super();

		/**
		 * @private
		 */
		this.context_ = context;

		/**
		 * @private
		 */
		this.center_ = center;

		/**
		 * @private
		 */
		this.extent_ = extent;

		/**
		 * @private
		 */
		this.pixelRatio_ = pixelRatio;

		/**
		 * @private
		 */
		this.size_ = size;

		/**
		 * @private
		 */
		this.rotation_ = rotation;

		/**
		 * @private
		 */
		this.resolution_ = resolution;

		/**
		 * @private
		 * @type {module:ol/style/Image}
		 */
		this.imageStyle_ = null;

		/**
		 * @private
		 * @type {module:ol/style/Fill}
		 */
		this.fillStyle_ = null;

		/**
		 * @private
		 * @type {module:ol/style/Stroke}
		 */
		this.strokeStyle_ = null;

		/**
		 * @private
		 * @type {module:ol/style/Text}
		 */
		this.textStyle_ = null;
	}

	/**
	 * Set the rendering style.  Note that since this is an immediate rendering API,
	 * any `zIndex` on the provided style will be ignored.
	 *
	 * @param {module:ol/style/Style} style The rendering style.
	 * @override
	 * @api
	 */
	public setStyle(style: Style) {
		this.setFillStrokeStyle(style.getFill(), style.getStroke());
		this.setImageStyle(style.getImage());
		this.setTextStyle(style.getText());
	}


	/**
	 * Render a geometry into the canvas.  Call
	 * {@link ol/render/webgl/Immediate#setStyle} first to set the rendering style.
	 *
	 * @param {module:ol/geom/Geometry|module:ol/render/Feature} geometry The geometry to render.
	 * @override
	 * @api
	 */
	public drawGeometry(geometry: Geometry) {
		const type = geometry.getType();
		switch (type) {
			case GeometryType.POINT:
				this.drawPoint(/** @type {module:ol/geom/Point} */(geometry as Point), null);
				break;
			case GeometryType.LINE_STRING:
				this.drawLineString(/** @type {module:ol/geom/LineString} */(geometry as LineString), null);
				break;
			case GeometryType.POLYGON:
				this.drawPolygon(/** @type {module:ol/geom/Polygon} */(geometry as Polygon), null);
				break;
			case GeometryType.MULTI_POINT:
				this.drawMultiPoint(/** @type {module:ol/geom/MultiPoint} */(geometry as MultiPoint), null);
				break;
			case GeometryType.MULTI_LINE_STRING:
				this.drawMultiLineString(/** @type {module:ol/geom/MultiLineString} */(geometry as MultiLineString), null);
				break;
			case GeometryType.MULTI_POLYGON:
				this.drawMultiPolygon(/** @type {module:ol/geom/MultiPolygon} */(geometry as MultiPolygon), null);
				break;
			case GeometryType.GEOMETRY_COLLECTION:
				this.drawGeometryCollection(/** @type {module:ol/geom/GeometryCollection} */(geometry as GeometryCollection), null);
				break;
			case GeometryType.CIRCLE:
				this.drawCircle(/** @type {module:ol/geom/Circle} */(geometry as Circle), null);
				break;
			default:
			// pass
		}
	}


	/**
	 * @inheritDoc
	 * @api
	 */
	public drawFeature(feature: Feature, style: Style): void {
		const geometry = style.getGeometryFunction()(feature) as Geometry;
		if (!geometry || !intersects(this.extent_, geometry.getExtent())) {
			return;
		}
		this.setStyle(style);
		this.drawGeometry(geometry);
	}


	/**
	 * @inheritDoc
	 */
	public drawGeometryCollection(geometry: GeometryCollection, _data: Feature): void {
		const geometries = geometry.getGeometriesArray();
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			this.drawGeometry(geometries[i]);
		}
	}

	/**
	 * @inheritDoc
	 */
	public drawPoint(geometry: Point | RenderFeature, data: Feature | RenderFeature): void {
		const context = this.context_;
		const replayGroup = new WebGLReplayGroup(1, this.extent_);
		const replay = /** @type {module:ol/render/webgl/ImageReplay} */ (
			replayGroup.getReplay(0, ReplayType.IMAGE));
		replay.setImageStyle(this.imageStyle_);
		replay.drawPoint(geometry, data);
		replay.finish(context);
		// default colors
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();

		if (this.textStyle_) {
			this.drawText_(replayGroup, geometry as Geometry);
		}
	}


	/**
	 * @inheritDoc
	 */
	public drawMultiPoint(geometry: MultiPoint | RenderFeature, data: Feature | RenderFeature): void {
		const context = this.context_;
		const replayGroup = new WebGLReplayGroup(1, this.extent_);
		const replay = /** @type {module:ol/render/webgl/ImageReplay} */ (
			replayGroup.getReplay(0, ReplayType.IMAGE));
		replay.setImageStyle(this.imageStyle_);
		replay.drawMultiPoint(geometry, data);
		replay.finish(context);
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();

		if (this.textStyle_) {
			this.drawText_(replayGroup, geometry as Geometry);
		}
	}


	/**
	 * @inheritDoc
	 */
	public drawLineString(geometry: LineString | RenderFeature, data: Feature | RenderFeature): void {
		const context = this.context_;
		const replayGroup = new WebGLReplayGroup(1, this.extent_);
		const replay = /** @type {module:ol/render/webgl/LineStringReplay} */ (
			replayGroup.getReplay(0, ReplayType.LINE_STRING));
		replay.setFillStrokeStyle(null, this.strokeStyle_);
		replay.drawLineString(geometry, data);
		replay.finish(context);
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();

		if (this.textStyle_) {
			this.drawText_(replayGroup, geometry as Geometry);
		}
	}

	/**
	 * @inheritDoc
	 */
	public drawMultiLineString(geometry: MultiLineString | RenderFeature, data: Feature | RenderFeature): void {
		const context = this.context_;
		const replayGroup = new WebGLReplayGroup(1, this.extent_);
		const replay = /** @type {module:ol/render/webgl/LineStringReplay} */ (
			replayGroup.getReplay(0, ReplayType.LINE_STRING));
		replay.setFillStrokeStyle(null, this.strokeStyle_);
		replay.drawMultiLineString(geometry, data);
		replay.finish(context);
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();

		if (this.textStyle_) {
			this.drawText_(replayGroup, geometry as Geometry);
		}
	}

	/**
	 * @inheritDoc
	 */
	public drawPolygon(geometry: Polygon | RenderFeature, data: Feature | RenderFeature): void {
		const context = this.context_;
		const replayGroup = new WebGLReplayGroup(1, this.extent_);
		const replay = /** @type {module:ol/render/webgl/PolygonReplay} */ (
			replayGroup.getReplay(0, ReplayType.POLYGON));
		replay.setFillStrokeStyle(this.fillStyle_, this.strokeStyle_);
		replay.drawPolygon(geometry, data);
		replay.finish(context);
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();

		if (this.textStyle_) {
			this.drawText_(replayGroup, geometry as Geometry);
		}
	}

	/**
	 * @inheritDoc
	 */
	public drawMultiPolygon(geometry: MultiPolygon, data: Feature | RenderFeature): void {
		const context = this.context_;
		const replayGroup = new WebGLReplayGroup(1, this.extent_);
		const replay = /** @type {module:ol/render/webgl/PolygonReplay} */ (
			replayGroup.getReplay(0, ReplayType.POLYGON));
		replay.setFillStrokeStyle(this.fillStyle_, this.strokeStyle_);
		replay.drawMultiPolygon(geometry, data);
		replay.finish(context);
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();

		if (this.textStyle_) {
			this.drawText_(replayGroup, geometry);
		}
	}

	/**
	 * @inheritDoc
	 */
	public drawCircle(geometry: Circle, data: Feature) {
		const context = this.context_;
		const replayGroup = new WebGLReplayGroup(1, this.extent_);
		const replay = /** @type {module:ol/render/webgl/CircleReplay} */ (
			replayGroup.getReplay(0, ReplayType.CIRCLE));
		replay.setFillStrokeStyle(this.fillStyle_, this.strokeStyle_);
		replay.drawCircle(geometry, data);
		replay.finish(context);
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();

		if (this.textStyle_) {
			this.drawText_(replayGroup, geometry);
		}
	}

	/**
	 * @inheritDoc
	 */
	public setImageStyle(imageStyle: Image) {
		this.imageStyle_ = imageStyle;
	}

	/**
	 * @inheritDoc
	 */
	public setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke) {
		this.fillStyle_ = fillStyle;
		this.strokeStyle_ = strokeStyle;
	}

	/**
	 * @inheritDoc
	 */
	public setTextStyle(textStyle: Text) {
		this.textStyle_ = textStyle;
	}

	public drawCustom(_geometry: SimpleGeometry, _feature: Feature | RenderFeature, _renderer: () => void): void {
		throw new Error('not impleted');
	}

	public drawText(_geometry: Geometry | RenderFeature, _feature: Feature | RenderFeature): void {
		throw new Error('not impleted');
	}

	/**
	 * @param {module:ol/render/webgl/ReplayGroup} replayGroup Replay group.
	 * @param {module:ol/geom/Geometry|module:ol/render/Feature} geometry Geometry.
	 * @private
	 */
	private drawText_(replayGroup: ReplayGroup, geometry: Geometry) {
		const context = this.context_;
		const replay = replayGroup.getReplay(0, ReplayType.TEXT) as WebGLTextReplay;
		replay.setTextStyle(this.textStyle_);
		replay.drawText(geometry, null);
		replay.finish(context);
		// default colors
		const opacity = 1;
		const skippedFeatures = {};
		const featureCallback = undefined as undefined;
		const oneByOne = false;
		replay.replay(this.context_, this.center_, this.resolution_, this.rotation_,
			this.size_, this.pixelRatio_, opacity, skippedFeatures, featureCallback,
			oneByOne);
		replay.getDeleteResourcesFunction(context)();
	}
}
