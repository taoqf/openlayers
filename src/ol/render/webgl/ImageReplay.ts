/**
 * @module ol/render/webgl/ImageReplay
 */
import { Extent } from '../../extent';
import Feature from '../../Feature';
import Circle from '../../geom/Circle';
import Geometry from '../../geom/Geometry';
import GeometryCollection from '../../geom/GeometryCollection';
import LineString from '../../geom/LineString';
import MultiLineString from '../../geom/MultiLineString';
import MultiPoint from '../../geom/MultiPoint';
import MultiPolygon from '../../geom/MultiPolygon';
import Point from '../../geom/Point';
import Polygon from '../../geom/Polygon';
import SimpleGeometry from '../../geom/SimpleGeometry';
import { getUid } from '../../index';
import { Fill, Image, Stroke, Style } from '../../style';
import Text from '../../style/Text';
import WebGLBuffer from '../../webgl/Buffer';
import WebGLContext from '../../webgl/Context';
import { DeclutterGroup } from '../canvas';
import RenderFeature from '../Feature';
import WebGLTextureReplay from '../webgl/TextureReplay';

/**
 * @constructor
 * @extends {module:ol/render/webgl/TextureReplay}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @struct
 */
export default class WebGLImageReplay extends WebGLTextureReplay {
	protected images_: Array<HTMLCanvasElement | HTMLImageElement | HTMLVideoElement>;
	protected hitDetectionImages_: Array<HTMLCanvasElement | HTMLImageElement | HTMLVideoElement>;
	private textures_: WebGLTexture[];
	private hitDetectionTextures_: WebGLTexture[];
	constructor(tolerance: number, maxExtent: Extent) {
		super(tolerance, maxExtent);

		/**
		 * @type {Array.<HTMLCanvasElement|HTMLImageElement|HTMLVideoElement>}
		 * @protected
		 */
		this.images_ = [];

		/**
		 * @type {Array.<HTMLCanvasElement|HTMLImageElement|HTMLVideoElement>}
		 * @protected
		 */
		this.hitDetectionImages_ = [];

		/**
		 * @type {Array.<WebGLTexture>}
		 * @private
		 */
		this.textures_ = [];

		/**
		 * @type {Array.<WebGLTexture>}
		 * @private
		 */
		this.hitDetectionTextures_ = [];

	}
	public setTextStyle(_textStyle: Text, _opt_declutterGroup?: DeclutterGroup) { }
	public setStyle(_style: Style) { }
	public setFillStrokeStyle(_fillStyle: Fill, _strokeStyle: Stroke) { }
	public drawText(_geometry: Geometry | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawPolygon(_polygonGeometry: Polygon | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawMultiPolygon(_multiPolygonGeometry: MultiPolygon, _feature: Feature | RenderFeature) { }
	public drawMultiLineString(_multiLineStringGeometry: MultiLineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawLineString(_lineStringGeometry: LineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawGeometryCollection(_geometryCollectionGeometry: GeometryCollection, _feature: Feature) { }
	public drawGeometry(_geometry: Geometry) { }
	public drawFeature(_feature: Feature, _style: Style) { }
	public drawCustom(_geometry: SimpleGeometry, _feature: Feature | RenderFeature, _renderer: () => void) { }
	public drawCircle(_circleGeometry: Circle, _feature: Feature) { }
	public drawMultiPoint(multiPointGeometry: MultiPoint | RenderFeature, feature: Feature | RenderFeature) {
		this.startIndices.push(this.indices.length);
		this.startIndicesFeature.push(feature);
		const flatCoordinates = multiPointGeometry.getFlatCoordinates();
		const stride = multiPointGeometry.getStride();
		this.drawCoordinates(
			flatCoordinates, 0, flatCoordinates.length, stride);
	}

	public drawPoint(pointGeometry: Point | RenderFeature, feature: Feature | RenderFeature) {
		this.startIndices.push(this.indices.length);
		this.startIndicesFeature.push(feature);
		const flatCoordinates = pointGeometry.getFlatCoordinates();
		const stride = pointGeometry.getStride();
		this.drawCoordinates(
			flatCoordinates, 0, flatCoordinates.length, stride);
	}

	public finish(context: WebGLContext) {
		const gl = context.getGL();

		this.groupIndices.push(this.indices.length);
		this.hitDetectionGroupIndices.push(this.indices.length);

		// create, bind, and populate the vertices buffer
		this.verticesBuffer = new WebGLBuffer(this.vertices);

		const indices = this.indices;

		// create, bind, and populate the indices buffer
		this.indicesBuffer = new WebGLBuffer(indices);

		// create textures
		/** @type {Object.<string, WebGLTexture>} */
		const texturePerImage = {};

		this.createTextures(this.textures_, this.images_, texturePerImage, gl);

		this.createTextures(this.hitDetectionTextures_, this.hitDetectionImages_,
			texturePerImage, gl);

		this.images_ = null;
		this.hitDetectionImages_ = null;
		WebGLTextureReplay.prototype.finish.call(this, context);
	}


	public setImageStyle(imageStyle: Image, _opt_declutterGroup?: DeclutterGroup) {
		const anchor = imageStyle.getAnchor();
		const image = imageStyle.getImage(1);
		const imageSize = imageStyle.getImageSize();
		const hitDetectionImage = imageStyle.getHitDetectionImage(1);
		const opacity = imageStyle.getOpacity();
		const origin = imageStyle.getOrigin();
		const rotateWithView = imageStyle.getRotateWithView();
		const rotation = imageStyle.getRotation();
		const size = imageStyle.getSize();
		const scale = imageStyle.getScale();

		let currentImage;
		if (this.images_.length === 0) {
			this.images_.push(image);
		} else {
			currentImage = this.images_[this.images_.length - 1];
			if (getUid(currentImage) !== getUid(image)) {
				this.groupIndices.push(this.indices.length);
				this.images_.push(image);
			}
		}

		if (this.hitDetectionImages_.length === 0) {
			this.hitDetectionImages_.push(hitDetectionImage);
		} else {
			currentImage =
				this.hitDetectionImages_[this.hitDetectionImages_.length - 1];
			if (getUid(currentImage) !== getUid(hitDetectionImage)) {
				this.hitDetectionGroupIndices.push(this.indices.length);
				this.hitDetectionImages_.push(hitDetectionImage);
			}
		}

		this.anchorX = anchor[0];
		this.anchorY = anchor[1];
		this.height = size[1];
		this.imageHeight = imageSize[1];
		this.imageWidth = imageSize[0];
		this.opacity = opacity;
		this.originX = origin[0];
		this.originY = origin[1];
		this.rotation = rotation;
		this.rotateWithView = rotateWithView;
		this.scale = scale;
		this.width = size[0];
	}

	protected getTextures(opt_all?: boolean) {
		return opt_all ? this.textures_.concat(this.hitDetectionTextures_) : this.textures_;
	}

	protected getHitDetectionTextures() {
		return this.hitDetectionTextures_;
	}
}
