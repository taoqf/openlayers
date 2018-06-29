/**
 * @module ol/render/canvas/Immediate
 */
// FIXME test, especially polygons with holes and multipolygons
// FIXME need to handle large thick features (where pixel size matters)
// FIXME add offset and end to ol/geom/flat/transform~transform2D?

import { equals } from '../../array';
import { asColorLike, ColorLike } from '../../colorlike';
import { Extent, intersects } from '../../extent';
import Feature from '../../Feature';
import Circle from '../../geom/Circle';
import { transform2D } from '../../geom/flat/transform';
import Geometry from '../../geom/Geometry';
import GeometryCollection from '../../geom/GeometryCollection';
import GeometryType from '../../geom/GeometryType';
import LineString from '../../geom/LineString';
import MultiLineString from '../../geom/MultiLineString';
import MultiPoint from '../../geom/MultiPoint';
import MultiPolygon from '../../geom/MultiPolygon';
import Point from '../../geom/Point';
import Polygon from '../../geom/Polygon';
import { transformGeom2D } from '../../geom/SimpleGeometry';
import { CANVAS_LINE_DASH } from '../../has';
import Fill from '../../style/Fill';
import ImageStyle from '../../style/Image';
import Stroke from '../../style/Stroke';
import Style from '../../style/Style';
import Text from '../../style/Text';
import { compose as composeTransform, create as createTransform, Transform } from '../../transform';
import { defaultFillStyle, defaultFont, defaultLineCap, defaultLineDash, defaultLineDashOffset, defaultLineJoin, defaultLineWidth, defaultMiterLimit, defaultStrokeStyle, defaultTextAlign, defaultTextBaseline, FillState, StrokeState, TextState } from '../canvas';
import RenderFeature from '../Feature';
import VectorContext from '../VectorContext';

/**
 * @classdesc
 * A concrete subclass of {@link module:ol/render/VectorContext} that implements
 * direct rendering of features and geometries to an HTML5 Canvas context.
 * Instances of this class are created internally by the library and
 * provided to application code as vectorContext member of the
 * {@link module:ol/render/Event~RenderEvent} object associated with postcompose, precompose and
 * render events emitted by layers and maps.
 *
 * @constructor
 * @extends {module:ol/render/VectorContext}
 * @param {CanvasRenderingContext2D} context Context.
 * @param {number} pixelRatio Pixel ratio.
 * @param {module:ol/extent~Extent} extent Extent.
 * @param {module:ol/transform~Transform} transform Transform.
 * @param {number} viewRotation View rotation.
 * @struct
 */
export default class CanvasImmediateRenderer extends VectorContext {
	private context: CanvasRenderingContext2D;
	private pixelRatio: number;
	private extent: Extent;
	private transform: Transform;
	private viewRotation: number;
	private contextFillState: FillState | null;
	private contextStrokeState: StrokeState | null;
	private contextTextState: TextState | null;
	private fillState: FillState | null;
	private strokeState: StrokeState | null;
	private image: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null;
	private imageAnchorX: number;
	private imageAnchorY: number;
	private imageHeight: number;
	private imageOpacity: number;
	private imageOriginX: number;
	private imageOriginY: number;
	private imageRotateWithView: boolean;
	private imageRotation: number;
	private imageScale: number;
	private imageSnapToPixel: boolean;
	private imageWidth: number;
	private text: string;
	private textOffsetX: number;
	private textOffsetY: number;
	private textRotateWithView: boolean;
	private textRotation: number;
	private textScale: number;
	private textFillState: FillState | null;
	private textStrokeState: StrokeState | null;
	private textState: TextState | null;
	private pixelCoordinates: number[];
	private tmpLocalTransform: number[];
	constructor(context: CanvasRenderingContext2D, pixelRatio: number, extent: Extent, transform: Transform, viewRotation: number) {
		super();

		/**
		 * @private
		 * @type {CanvasRenderingContext2D}
		 */
		this.context = context;

		/**
		 * @private
		 * @type {number}
		 */
		this.pixelRatio = pixelRatio;

		/**
		 * @private
		 * @type {module:ol/extent~Extent}
		 */
		this.extent = extent;

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.transform = transform;

		/**
		 * @private
		 * @type {number}
		 */
		this.viewRotation = viewRotation;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~FillState}
		 */
		this.contextFillState = null;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~StrokeState}
		 */
		this.contextStrokeState = null;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~TextState}
		 */
		this.contextTextState = null;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~FillState}
		 */
		this.fillState = null;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~StrokeState}
		 */
		this.strokeState = null;

		/**
		 * @private
		 * @type {HTMLCanvasElement|HTMLVideoElement|Image}
		 */
		this.image = null;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageAnchorX = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageAnchorY = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageHeight = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageOpacity = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageOriginX = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageOriginY = 0;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.imageRotateWithView = false;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageRotation = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageScale = 0;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.imageSnapToPixel = false;

		/**
		 * @private
		 * @type {number}
		 */
		this.imageWidth = 0;

		/**
		 * @private
		 * @type {string}
		 */
		this.text = '';

		/**
		 * @private
		 * @type {number}
		 */
		this.textOffsetX = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.textOffsetY = 0;

		/**
		 * @private
		 * @type {boolean}
		 */
		this.textRotateWithView = false;

		/**
		 * @private
		 * @type {number}
		 */
		this.textRotation = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.textScale = 0;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~FillState}
		 */
		this.textFillState = null;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~StrokeState}
		 */
		this.textStrokeState = null;

		/**
		 * @private
		 * @type {?module:ol/render/canvas~TextState}
		 */
		this.textState = null;

		/**
		 * @private
		 * @type {Array.<number>}
		 */
		this.pixelCoordinates = [];

		/**
		 * @private
		 * @type {module:ol/transform~Transform}
		 */
		this.tmpLocalTransform = createTransform();

	}
	public drawCustom() { }
	public drawText() { }
	/**
	 * Render a circle geometry into the canvas.  Rendering is immediate and uses
	 * the current fill and stroke styles.
	 *
	 * @param {module:ol/geom/Circle} geometry Circle geometry.
	 * @override
	 * @api
	 */
	public drawCircle(geometry: Circle) {
		if (!intersects(this.extent, geometry.getExtent())) {
			return;
		}
		if (this.fillState || this.strokeState) {
			if (this.fillState) {
				this.setContextFillState_(this.fillState);
			}
			if (this.strokeState) {
				this.setContextStrokeState_(this.strokeState);
			}
			const pixelCoordinates = transformGeom2D(
				geometry, this.transform, this.pixelCoordinates)!;
			const dx = pixelCoordinates[2] - pixelCoordinates[0];
			const dy = pixelCoordinates[3] - pixelCoordinates[1];
			const radius = Math.sqrt(dx * dx + dy * dy);
			const context = this.context;
			context.beginPath();
			context.arc(
				pixelCoordinates[0], pixelCoordinates[1], radius, 0, 2 * Math.PI);
			if (this.fillState) {
				context.fill();
			}
			if (this.strokeState) {
				context.stroke();
			}
		}
		if (this.text !== '') {
			this.drawText_(geometry.getCenter(), 0, 2, 2);
		}
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
		this.setFillStrokeStyle(style.getFill()!, style.getStroke()!);
		this.setImageStyle(style.getImage()!);
		this.setTextStyle(style.getText()!);
	}

	/**
	 * Render a geometry into the canvas.  Call
	 * {@link module:ol/render/canvas/Immediate#setStyle} first to set the rendering style.
	 *
	 * @param {module:ol/geom/Geometry|module:ol/render/Feature} geometry The geometry to render.
	 * @override
	 * @api
	 */
	public drawGeometry(geometry: Geometry | RenderFeature) {
		const type = geometry.getType();
		switch (type) {
			case GeometryType.POINT:
				this.drawPoint(/** @type {module:ol/geom/Point} */(geometry as Point));
				break;
			case GeometryType.LINE_STRING:
				this.drawLineString(/** @type {module:ol/geom/LineString} */(geometry as LineString));
				break;
			case GeometryType.POLYGON:
				this.drawPolygon(/** @type {module:ol/geom/Polygon} */(geometry as Polygon));
				break;
			case GeometryType.MULTI_POINT:
				this.drawMultiPoint(/** @type {module:ol/geom/MultiPoint} */(geometry as MultiPoint));
				break;
			case GeometryType.MULTI_LINE_STRING:
				this.drawMultiLineString(/** @type {module:ol/geom/MultiLineString} */(geometry as MultiLineString));
				break;
			case GeometryType.MULTI_POLYGON:
				this.drawMultiPolygon(/** @type {module:ol/geom/MultiPolygon} */(geometry as MultiPolygon));
				break;
			case GeometryType.GEOMETRY_COLLECTION:
				this.drawGeometryCollection(/** @type {module:ol/geom/GeometryCollection} */(geometry as GeometryCollection));
				break;
			case GeometryType.CIRCLE:
				this.drawCircle(/** @type {module:ol/geom/Circle} */(geometry as Circle));
				break;
			default:
		}
	}


	/**
	 * Render a feature into the canvas.  Note that any `zIndex` on the provided
	 * style will be ignored - features are rendered immediately in the order that
	 * this method is called.  If you need `zIndex` support, you should be using an
	 * {@link module:ol/layer/Vector~VectorLayer} instead.
	 *
	 * @param {module:ol/Feature} feature Feature.
	 * @param {module:ol/style/Style} style Style.
	 * @override
	 * @api
	 */
	public drawFeature(feature: Feature, style: Style) {
		const geometry = style.getGeometryFunction()(feature);
		if (!geometry || !intersects(this.extent, geometry.getExtent())) {
			return;
		}
		this.setStyle(style);
		this.drawGeometry(geometry);
	}


	/**
	 * Render a GeometryCollection to the canvas.  Rendering is immediate and
	 * uses the current styles appropriate for each geometry in the collection.
	 *
	 * @param {module:ol/geom/GeometryCollection} geometry Geometry collection.
	 * @override
	 */
	public drawGeometryCollection(geometry: GeometryCollection) {
		const geometries = geometry.getGeometriesArray()!;
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			this.drawGeometry(geometries[i]);
		}
	}


	/**
	 * Render a Point geometry into the canvas.  Rendering is immediate and uses
	 * the current style.
	 *
	 * @param {module:ol/geom/Point|module:ol/render/Feature} geometry Point geometry.
	 * @override
	 */
	public drawPoint(geometry: Point | RenderFeature) {
		const flatCoordinates = geometry.getFlatCoordinates();
		const stride = geometry.getStride();
		if (this.image) {
			this.drawImages_(flatCoordinates, 0, flatCoordinates.length, stride);
		}
		if (this.text !== '') {
			this.drawText_(flatCoordinates, 0, flatCoordinates.length, stride);
		}
	}


	/**
	 * Render a MultiPoint geometry  into the canvas.  Rendering is immediate and
	 * uses the current style.
	 *
	 * @param {module:ol/geom/MultiPoint|module:ol/render/Feature} geometry MultiPoint geometry.
	 * @override
	 */
	public drawMultiPoint(geometry: MultiPoint | RenderFeature) {
		const flatCoordinates = geometry.getFlatCoordinates();
		const stride = geometry.getStride();
		if (this.image) {
			this.drawImages_(flatCoordinates, 0, flatCoordinates.length, stride);
		}
		if (this.text !== '') {
			this.drawText_(flatCoordinates, 0, flatCoordinates.length, stride);
		}
	}


	/**
	 * Render a LineString into the canvas.  Rendering is immediate and uses
	 * the current style.
	 *
	 * @param {module:ol/geom/LineString|module:ol/render/Feature} geometry LineString geometry.
	 * @override
	 */
	public drawLineString(geometry: LineString | RenderFeature) {
		if (!intersects(this.extent, geometry.getExtent())) {
			return;
		}
		if (this.strokeState) {
			this.setContextStrokeState_(this.strokeState);
			const context = this.context;
			const flatCoordinates = geometry.getFlatCoordinates();
			context.beginPath();
			this.moveToLineTo_(flatCoordinates, 0, flatCoordinates.length,
				geometry.getStride(), false);
			context.stroke();
		}
		if (this.text !== '') {
			const flatMidpoint = geometry.getFlatMidpoint()!;
			this.drawText_(flatMidpoint, 0, 2, 2);
		}
	}


	/**
	 * Render a MultiLineString geometry into the canvas.  Rendering is immediate
	 * and uses the current style.
	 *
	 * @param {module:ol/geom/MultiLineString|module:ol/render/Feature} geometry MultiLineString geometry.
	 * @override
	 */
	public drawMultiLineString(geometry: MultiLineString | RenderFeature) {
		const geometryExtent = geometry.getExtent();
		if (!intersects(this.extent, geometryExtent)) {
			return;
		}
		if (this.strokeState) {
			this.setContextStrokeState_(this.strokeState);
			const context = this.context;
			const flatCoordinates = geometry.getFlatCoordinates();
			let offset = 0;
			const ends = geometry.getEnds();
			const stride = geometry.getStride();
			context.beginPath();
			for (let i = 0, ii = ends.length; i < ii; ++i) {
				offset = this.moveToLineTo_(flatCoordinates, offset, ends[i] as number, stride, false);
			}
			context.stroke();
		}
		if (this.text !== '') {
			const flatMidpoints = geometry.getFlatMidpoints();
			this.drawText_(flatMidpoints, 0, flatMidpoints.length, 2);
		}
	}


	/**
	 * Render a Polygon geometry into the canvas.  Rendering is immediate and uses
	 * the current style.
	 *
	 * @param {module:ol/geom/Polygon|module:ol/render/Feature} geometry Polygon geometry.
	 * @override
	 */
	public drawPolygon(geometry: Polygon | RenderFeature) {
		if (!intersects(this.extent, geometry.getExtent())) {
			return;
		}
		if (this.strokeState || this.fillState) {
			if (this.fillState) {
				this.setContextFillState_(this.fillState);
			}
			if (this.strokeState) {
				this.setContextStrokeState_(this.strokeState);
			}
			const context = this.context;
			context.beginPath();
			this.drawRings_(geometry.getOrientedFlatCoordinates(),
				0, geometry.getEnds() as number[], geometry.getStride());
			if (this.fillState) {
				context.fill();
			}
			if (this.strokeState) {
				context.stroke();
			}
		}
		if (this.text !== '') {
			const flatInteriorPoint = geometry.getFlatInteriorPoint();
			this.drawText_(flatInteriorPoint, 0, 2, 2);
		}
	}


	/**
	 * Render MultiPolygon geometry into the canvas.  Rendering is immediate and
	 * uses the current style.
	 * @param {module:ol/geom/MultiPolygon} geometry MultiPolygon geometry.
	 * @override
	 */
	public drawMultiPolygon(geometry: MultiPolygon) {
		if (!intersects(this.extent, geometry.getExtent())) {
			return;
		}
		if (this.strokeState || this.fillState) {
			if (this.fillState) {
				this.setContextFillState_(this.fillState);
			}
			if (this.strokeState) {
				this.setContextStrokeState_(this.strokeState);
			}
			const context = this.context;
			const flatCoordinates = geometry.getOrientedFlatCoordinates();
			let offset = 0;
			const endss = geometry.getEndss();
			const stride = geometry.getStride();
			context.beginPath();
			for (let i = 0, ii = endss.length; i < ii; ++i) {
				const ends = endss[i];
				offset = this.drawRings_(flatCoordinates, offset, ends, stride);
			}
			if (this.fillState) {
				context.fill();
			}
			if (this.strokeState) {
				context.stroke();
			}
		}
		if (this.text !== '') {
			const flatInteriorPoints = geometry.getFlatInteriorPoints();
			this.drawText_(flatInteriorPoints, 0, flatInteriorPoints.length, 2);
		}
	}

	/**
	 * Set the fill and stroke style for subsequent draw operations.  To clear
	 * either fill or stroke styles, pass null for the appropriate parameter.
	 *
	 * @param {module:ol/style/Fill} fillStyle Fill style.
	 * @param {module:ol/style/Stroke} strokeStyle Stroke style.
	 * @override
	 */
	public setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke) {
		if (!fillStyle) {
			this.fillState = null;
		} else {
			const fillStyleColor = fillStyle.getColor();
			this.fillState = {
				fillStyle: asColorLike(fillStyleColor ?
					fillStyleColor : defaultFillStyle) as ColorLike
			};
		}
		if (!strokeStyle) {
			this.strokeState = null;
		} else {
			const strokeStyleColor = strokeStyle.getColor();
			const strokeStyleLineCap = strokeStyle.getLineCap();
			const strokeStyleLineDash = strokeStyle.getLineDash();
			const strokeStyleLineDashOffset = strokeStyle.getLineDashOffset();
			const strokeStyleLineJoin = strokeStyle.getLineJoin();
			const strokeStyleWidth = strokeStyle.getWidth();
			const strokeStyleMiterLimit = strokeStyle.getMiterLimit();
			this.strokeState = {
				lineCap: strokeStyleLineCap !== undefined ?
					strokeStyleLineCap : defaultLineCap,
				lineDash: strokeStyleLineDash ?
					strokeStyleLineDash : defaultLineDash,
				lineDashOffset: strokeStyleLineDashOffset ?
					strokeStyleLineDashOffset : defaultLineDashOffset,
				lineJoin: strokeStyleLineJoin !== undefined ?
					strokeStyleLineJoin : defaultLineJoin,
				lineWidth: this.pixelRatio * (strokeStyleWidth !== undefined ?
					strokeStyleWidth : defaultLineWidth),
				miterLimit: strokeStyleMiterLimit !== undefined ?
					strokeStyleMiterLimit : defaultMiterLimit,
				strokeStyle: asColorLike(strokeStyleColor ?
					strokeStyleColor : defaultStrokeStyle)
			} as StrokeState;
		}
	}


	/**
	 * Set the image style for subsequent draw operations.  Pass null to remove
	 * the image style.
	 *
	 * @param {module:ol/style/Image} imageStyle Image style.
	 * @override
	 */
	public setImageStyle(imageStyle: ImageStyle) {
		if (!imageStyle) {
			this.image = null;
		} else {
			const imageAnchor = imageStyle.getAnchor()!;
			// FIXME pixel ratio
			const imageImage = imageStyle.getImage(1);
			const imageOrigin = imageStyle.getOrigin()!;
			const imageSize = imageStyle.getSize()!;
			this.imageAnchorX = imageAnchor[0];
			this.imageAnchorY = imageAnchor[1];
			this.imageHeight = imageSize[1];
			this.image = imageImage;
			this.imageOpacity = imageStyle.getOpacity();
			this.imageOriginX = imageOrigin[0];
			this.imageOriginY = imageOrigin[1];
			this.imageRotateWithView = imageStyle.getRotateWithView();
			this.imageRotation = imageStyle.getRotation();
			this.imageScale = imageStyle.getScale() * this.pixelRatio;
			this.imageSnapToPixel = imageStyle.getSnapToPixel();
			this.imageWidth = imageSize[0];
		}
	}


	/**
	 * Set the text style for subsequent draw operations.  Pass null to
	 * remove the text style.
	 *
	 * @param {module:ol/style/Text} textStyle Text style.
	 * @override
	 */
	public setTextStyle(textStyle: Text) {
		if (!textStyle) {
			this.text = '';
		} else {
			const textFillStyle = textStyle.getFill();
			if (!textFillStyle) {
				this.textFillState = null;
			} else {
				const textFillStyleColor = textFillStyle.getColor();
				this.textFillState = {
					fillStyle: asColorLike(textFillStyleColor ?
						textFillStyleColor : defaultFillStyle)
				} as FillState;
			}
			const textStrokeStyle = textStyle.getStroke();
			if (!textStrokeStyle) {
				this.textStrokeState = null;
			} else {
				const textStrokeStyleColor = textStrokeStyle.getColor();
				const textStrokeStyleLineCap = textStrokeStyle.getLineCap();
				const textStrokeStyleLineDash = textStrokeStyle.getLineDash();
				const textStrokeStyleLineDashOffset = textStrokeStyle.getLineDashOffset();
				const textStrokeStyleLineJoin = textStrokeStyle.getLineJoin();
				const textStrokeStyleWidth = textStrokeStyle.getWidth();
				const textStrokeStyleMiterLimit = textStrokeStyle.getMiterLimit();
				this.textStrokeState = {
					lineCap: textStrokeStyleLineCap !== undefined ?
						textStrokeStyleLineCap : defaultLineCap,
					lineDash: textStrokeStyleLineDash ?
						textStrokeStyleLineDash : defaultLineDash,
					lineDashOffset: textStrokeStyleLineDashOffset ?
						textStrokeStyleLineDashOffset : defaultLineDashOffset,
					lineJoin: textStrokeStyleLineJoin !== undefined ?
						textStrokeStyleLineJoin : defaultLineJoin,
					lineWidth: textStrokeStyleWidth !== undefined ?
						textStrokeStyleWidth : defaultLineWidth,
					miterLimit: textStrokeStyleMiterLimit !== undefined ?
						textStrokeStyleMiterLimit : defaultMiterLimit,
					strokeStyle: asColorLike(textStrokeStyleColor ?
						textStrokeStyleColor : defaultStrokeStyle)
				} as StrokeState;
			}
			const textFont = textStyle.getFont();
			const textOffsetX = textStyle.getOffsetX();
			const textOffsetY = textStyle.getOffsetY();
			const textRotateWithView = textStyle.getRotateWithView();
			const textRotation = textStyle.getRotation();
			const textScale = textStyle.getScale();
			const textText = textStyle.getText();
			const textTextAlign = textStyle.getTextAlign();
			const textTextBaseline = textStyle.getTextBaseline();
			this.textState = {
				font: textFont !== undefined ?
					textFont : defaultFont,
				textAlign: textTextAlign !== undefined ?
					textTextAlign : defaultTextAlign,
				textBaseline: textTextBaseline !== undefined ?
					textTextBaseline : defaultTextBaseline
			} as TextState;
			this.text = textText !== undefined ? textText : '';
			this.textOffsetX =
				textOffsetX !== undefined ? (this.pixelRatio * textOffsetX) : 0;
			this.textOffsetY =
				textOffsetY !== undefined ? (this.pixelRatio * textOffsetY) : 0;
			this.textRotateWithView = textRotateWithView !== undefined ? textRotateWithView : false;
			this.textRotation = textRotation !== undefined ? textRotation : 0;
			this.textScale = this.pixelRatio * (textScale !== undefined ?
				textScale : 1);
		}
	}


	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 * @private
	 */
	private drawImages_(flatCoordinates: number[], offset: number, end: number, _stride: number) {
		if (!this.image) {
			return;
		}
		const pixelCoordinates = transform2D(
			flatCoordinates, offset, end, 2, this.transform,
			this.pixelCoordinates);
		const context = this.context;
		const localTransform = this.tmpLocalTransform;
		const alpha = context.globalAlpha;
		if (this.imageOpacity !== 1) {
			context.globalAlpha = alpha * this.imageOpacity;
		}
		let rotation = this.imageRotation;
		if (this.imageRotateWithView) {
			rotation += this.viewRotation;
		}
		for (let i = 0, ii = pixelCoordinates.length; i < ii; i += 2) {
			let x = pixelCoordinates[i] - this.imageAnchorX;
			let y = pixelCoordinates[i + 1] - this.imageAnchorY;
			if (this.imageSnapToPixel) {
				x = Math.round(x);
				y = Math.round(y);
			}
			if (rotation !== 0 || this.imageScale !== 1) {
				const centerX = x + this.imageAnchorX;
				const centerY = y + this.imageAnchorY;
				composeTransform(localTransform,
					centerX, centerY,
					this.imageScale, this.imageScale,
					rotation,
					-centerX, -centerY);
				context.setTransform.apply(context, localTransform);
			}
			context.drawImage(this.image, this.imageOriginX, this.imageOriginY,
				this.imageWidth, this.imageHeight, x, y,
				this.imageWidth, this.imageHeight);
		}
		if (rotation !== 0 || this.imageScale !== 1) {
			context.setTransform(1, 0, 0, 1, 0, 0);
		}
		if (this.imageOpacity !== 1) {
			context.globalAlpha = alpha;
		}
	}


	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 * @private
	 */
	private drawText_(flatCoordinates: number[], offset: number, end: number, stride: number) {
		if (!this.textState || this.text === '') {
			return;
		}
		if (this.textFillState) {
			this.setContextFillState_(this.textFillState);
		}
		if (this.textStrokeState) {
			this.setContextStrokeState_(this.textStrokeState);
		}
		this.setContextTextState_(this.textState);
		const pixelCoordinates = transform2D(
			flatCoordinates, offset, end, stride, this.transform,
			this.pixelCoordinates);
		const context = this.context;
		let rotation = this.textRotation;
		if (this.textRotateWithView) {
			rotation += this.viewRotation;
		}
		for (; offset < end; offset += stride) {
			const x = pixelCoordinates[offset] + this.textOffsetX;
			const y = pixelCoordinates[offset + 1] + this.textOffsetY;
			if (rotation !== 0 || this.textScale !== 1) {
				const localTransform = composeTransform(this.tmpLocalTransform,
					x, y,
					this.textScale, this.textScale,
					rotation,
					-x, -y);
				context.setTransform.apply(context, localTransform);
			}
			if (this.textStrokeState) {
				context.strokeText(this.text, x, y);
			}
			if (this.textFillState) {
				context.fillText(this.text, x, y);
			}
		}
		if (rotation !== 0 || this.textScale !== 1) {
			context.setTransform(1, 0, 0, 1, 0, 0);
		}
	}

	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 * @param {boolean} close Close.
	 * @private
	 * @return {number} end End.
	 */
	private moveToLineTo_(flatCoordinates: number[], offset: number, end: number, stride: number, close: boolean) {
		const context = this.context;
		const pixelCoordinates = transform2D(
			flatCoordinates, offset, end, stride, this.transform,
			this.pixelCoordinates);
		context.moveTo(pixelCoordinates[0], pixelCoordinates[1]);
		let length = pixelCoordinates.length;
		if (close) {
			length -= 2;
		}
		for (let i = 2; i < length; i += 2) {
			context.lineTo(pixelCoordinates[i], pixelCoordinates[i + 1]);
		}
		if (close) {
			context.closePath();
		}
		return end;
	}


	/**
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {Array.<number>} ends Ends.
	 * @param {number} stride Stride.
	 * @private
	 * @return {number} End.
	 */
	private drawRings_(flatCoordinates: number[], offset: number, ends: number[], stride: number) {
		for (let i = 0, ii = ends.length; i < ii; ++i) {
			offset = this.moveToLineTo_(flatCoordinates, offset, ends[i], stride, true);
		}
		return offset;
	}


	/**
	 * @param {module:ol/render/canvas~FillState} fillState Fill state.
	 * @private
	 */
	private setContextFillState_(fillState: FillState) {
		const context = this.context;
		const contextFillState = this.contextFillState;
		if (!contextFillState) {
			context.fillStyle = fillState.fillStyle!;
			this.contextFillState = {
				fillStyle: fillState.fillStyle
			};
		} else {
			if (contextFillState.fillStyle !== fillState.fillStyle) {
				contextFillState.fillStyle = context.fillStyle = fillState.fillStyle!;
			}
		}
	}


	/**
	 * @param {module:ol/render/canvas~StrokeState} strokeState Stroke state.
	 * @private
	 */
	private setContextStrokeState_(strokeState: StrokeState) {
		const context = this.context;
		const contextStrokeState = this.contextStrokeState;
		if (!contextStrokeState) {
			context.lineCap = strokeState.lineCap;
			if (CANVAS_LINE_DASH) {
				context.setLineDash(strokeState.lineDash);
				context.lineDashOffset = strokeState.lineDashOffset;
			}
			context.lineJoin = strokeState.lineJoin;
			context.lineWidth = strokeState.lineWidth;
			context.miterLimit = strokeState.miterLimit;
			context.strokeStyle = strokeState.strokeStyle;
			this.contextStrokeState = {
				lineCap: strokeState.lineCap,
				lineDash: strokeState.lineDash,
				lineDashOffset: strokeState.lineDashOffset,
				lineJoin: strokeState.lineJoin,
				lineWidth: strokeState.lineWidth,
				miterLimit: strokeState.miterLimit,
				strokeStyle: strokeState.strokeStyle
			};
		} else {
			if (contextStrokeState.lineCap !== strokeState.lineCap) {
				contextStrokeState.lineCap = context.lineCap = strokeState.lineCap;
			}
			if (CANVAS_LINE_DASH) {
				if (!equals(contextStrokeState.lineDash, strokeState.lineDash)) {
					context.setLineDash(contextStrokeState.lineDash = strokeState.lineDash);
				}
				if (contextStrokeState.lineDashOffset !== strokeState.lineDashOffset) {
					contextStrokeState.lineDashOffset = context.lineDashOffset =
						strokeState.lineDashOffset;
				}
			}
			if (contextStrokeState.lineJoin !== strokeState.lineJoin) {
				contextStrokeState.lineJoin = context.lineJoin = strokeState.lineJoin;
			}
			if (contextStrokeState.lineWidth !== strokeState.lineWidth) {
				contextStrokeState.lineWidth = context.lineWidth = strokeState.lineWidth;
			}
			if (contextStrokeState.miterLimit !== strokeState.miterLimit) {
				contextStrokeState.miterLimit = context.miterLimit =
					strokeState.miterLimit;
			}
			if (contextStrokeState.strokeStyle !== strokeState.strokeStyle) {
				contextStrokeState.strokeStyle = context.strokeStyle =
					strokeState.strokeStyle;
			}
		}
	}

	/**
	 * @param {module:ol/render/canvas~TextState} textState Text state.
	 * @private
	 */
	private setContextTextState_(textState: TextState) {
		const context = this.context;
		const contextTextState = this.contextTextState;
		const textAlign = textState.textAlign ?
			textState.textAlign : defaultTextAlign;
		if (!contextTextState) {
			context.font = textState.font;
			context.textAlign = textAlign as string;
			context.textBaseline = textState.textBaseline;
			this.contextTextState = {
				font: textState.font,
				textAlign,
				textBaseline: textState.textBaseline
			} as TextState;
		} else {
			if (contextTextState.font !== textState.font) {
				contextTextState.font = context.font = textState.font;
			}
			if (contextTextState.textAlign !== textAlign) {
				contextTextState.textAlign = context.textAlign = textAlign as string;
			}
			if (contextTextState.textBaseline !== textState.textBaseline) {
				contextTextState.textBaseline = context.textBaseline =
					textState.textBaseline;
			}
		}
	}
}
