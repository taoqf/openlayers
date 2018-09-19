/**
 * @module ol/render/webgl/TextReplay
 */
import { asColorLike, ColorLike } from '../../colorlike';
import { createCanvasContext2D } from '../../dom';
import { Extent } from '../../extent';
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
import { CANVAS_LINE_DASH } from '../../has';
import { getUid } from '../../index';
import AtlasManager from '../../style/AtlasManager';
import Fill from '../../style/Fill';
import Image from '../../style/Image';
import Stroke from '../../style/Stroke';
import Style from '../../style/Style';
import Text from '../../style/Text';
import WebGLBuffer from '../../webgl/Buffer';
import WebGLContext from '../../webgl/Context';
import { DeclutterGroup } from '../canvas';
import RenderFeature from '../Feature';
import { TEXT_ALIGN } from '../replay';
import {
	DEFAULT_FILLSTYLE,
	DEFAULT_FONT,
	DEFAULT_LINECAP,
	DEFAULT_LINEDASH,
	DEFAULT_LINEDASHOFFSET,
	DEFAULT_LINEJOIN,
	DEFAULT_LINEWIDTH,
	DEFAULT_MITERLIMIT,
	DEFAULT_STROKESTYLE,
	DEFAULT_TEXTALIGN,
	DEFAULT_TEXTBASELINE
} from '../webgl';
import WebGLTextureReplay from '../webgl/TextureReplay';

/**
 * @typedef {Object} GlyphAtlas
 * @property {module:ol/style/AtlasManager} atlas
 * @property {Object.<string, number>} width
 * @property {number} height
 */

interface GlyphAtlas {
	atlas: AtlasManager;
	width: { [key: string]: number; };
	height: number;
}

/**
 * @constructor
 * @extends {module:ol/render/webgl/TextureReplay}
 * @param {number} tolerance Tolerance.
 * @param {module:ol/extent~Extent} maxExtent Max extent.
 * @struct
 */
export default class WebGLTextReplay extends WebGLTextureReplay {
	private images_: HTMLCanvasElement[];
	private textures_: WebGLTexture[];
	private measureCanvas_: HTMLCanvasElement;

	private state_: {
		strokeColor: ColorLike | null;
		lineCap: string | undefined;
		lineDash: number[];
		lineDashOffset: number | undefined;
		lineJoin: string | undefined;
		lineWidth: number;
		miterLimit: number | undefined;
		fillColor: ColorLike;
		font: string | undefined;
		scale: number | undefined;
	};
	private text_: string;
	private textAlign_: number | undefined;
	private textBaseline_: number | undefined;
	private offsetX_: number | undefined;
	private offsetY_: number | undefined;
	private atlases_: { [glyph: string]: GlyphAtlas; };
	private currAtlas_: GlyphAtlas | undefined;
	constructor(tolerance: number, maxExtent: Extent) {
		super(tolerance, maxExtent);

		/**
		 * @private
		 * @type {Array.<HTMLCanvasElement>}
		 */
		this.images_ = [];

		/**
		 * @private
		 * @type {Array.<WebGLTexture>}
		 */
		this.textures_ = [];

		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.measureCanvas_ = createCanvasContext2D(0, 0).canvas;

		/**
		 * @private
		 * @type {{strokeColor: (module:ol/colorlike~ColorLike|null),
		 *         lineCap: (string|undefined),
		 *         lineDash: Array.<number>,
		 *         lineDashOffset: (number|undefined),
		 *         lineJoin: (string|undefined),
		 *         lineWidth: number,
		 *         miterLimit: (number|undefined),
		 *         fillColor: (module:ol/colorlike~ColorLike|null),
		 *         font: (string|undefined),
		 *         scale: (number|undefined)}}
		 */
		this.state_ = {
			fillColor: null,
			font: undefined,
			lineCap: undefined,
			lineDash: null,
			lineDashOffset: undefined,
			lineJoin: undefined,
			lineWidth: 0,
			miterLimit: undefined,
			scale: undefined,
			strokeColor: null
		};

		/**
		 * @private
		 * @type {string}
		 */
		this.text_ = '';

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.textAlign_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.textBaseline_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.offsetX_ = undefined;

		/**
		 * @private
		 * @type {number|undefined}
		 */
		this.offsetY_ = undefined;

		/**
		 * @private
		 * @type {Object.<string, module:ol/render/webgl/TextReplay~GlyphAtlas>}
		 */
		this.atlases_ = {};

		/**
		 * @private
		 * @type {module:ol/render/webgl/TextReplay~GlyphAtlas|undefined}
		 */
		this.currAtlas_ = undefined;

		this.scale = 1;

		this.opacity = 1;

	}
	public setImageStyle(_imageStyle: Image, _opt_declutterGroup?: DeclutterGroup) { }
	public drawPoint(_pointGeometry: Point | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawMultiPoint(_multiPointGeometry: MultiPoint | RenderFeature, _feature: Feature | RenderFeature) { }
	public setStyle(_style: Style) { }
	public setFillStrokeStyle(_fillStyle: Fill, _strokeStyle: Stroke) { }
	public drawPolygon(_polygonGeometry: Polygon | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawMultiPolygon(_multiPolygonGeometry: MultiPolygon, _feature: Feature | RenderFeature) { }
	public drawMultiLineString(_multiLineStringGeometry: MultiLineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawLineString(_lineStringGeometry: LineString | RenderFeature, _feature: Feature | RenderFeature) { }
	public drawGeometryCollection(_geometryCollectionGeometry: GeometryCollection, _feature: Feature) { }
	public drawGeometry(_geometry: Geometry) { }
	public drawFeature(_feature: Feature, _style: Style) { }
	public drawCustom(_geometry: SimpleGeometry, _feature: Feature | RenderFeature, _renderer: () => void) { }
	public drawCircle(_circleGeometry: Circle, _feature: Feature) { }
	public drawText(geometry: Geometry | RenderFeature, feature: Feature | RenderFeature) {
		if (this.text_) {
			let flatCoordinates = null;
			const offset = 0;
			let end = 2;
			let stride = 2;
			switch (geometry.getType()) {
				case GeometryType.POINT:
				case GeometryType.MULTI_POINT:
					flatCoordinates = (geometry as MultiPoint).getFlatCoordinates();
					end = flatCoordinates.length;
					stride = (geometry as MultiPoint).getStride();
					break;
				case GeometryType.CIRCLE:
					flatCoordinates = (geometry as Circle).getCenter();
					break;
				case GeometryType.LINE_STRING:
					flatCoordinates = (geometry as LineString).getFlatMidpoint();
					break;
				case GeometryType.MULTI_LINE_STRING:
					flatCoordinates = (geometry as MultiLineString).getFlatMidpoints();
					end = flatCoordinates.length;
					break;
				case GeometryType.POLYGON:
					flatCoordinates = (geometry as Polygon).getFlatInteriorPoint();
					break;
				case GeometryType.MULTI_POLYGON:
					flatCoordinates = (geometry as MultiPolygon).getFlatInteriorPoints();
					end = flatCoordinates.length;
					break;
				default:
			}
			this.startIndices.push(this.indices.length);
			this.startIndicesFeature.push(feature);

			const glyphAtlas = this.currAtlas_;
			const lines = this.text_.split('\n');
			const textSize = this.getTextSize_(lines);
			const anchorX = Math.round(textSize[0] * this.textAlign_ - this.offsetX_);
			const anchorY = Math.round(textSize[1] * this.textBaseline_ - this.offsetY_);
			const lineWidth = (this.state_.lineWidth / 2) * this.state_.scale;

			for (let i = 0, ii = lines.length; i < ii; ++i) {
				let currX = 0;
				const currY = glyphAtlas.height * i;
				const charArr = lines[i].split('');

				for (let j = 0, jj = charArr.length; j < jj; ++j) {
					const charInfo = glyphAtlas.atlas.getInfo(charArr[j]);

					if (charInfo) {
						const image = charInfo.image;

						this.anchorX = anchorX - currX;
						this.anchorY = anchorY - currY;
						this.originX = j === 0 ? charInfo.offsetX - lineWidth : charInfo.offsetX;
						this.originY = charInfo.offsetY;
						this.height = glyphAtlas.height;
						this.width = j === 0 || j === charArr.length - 1 ?
							glyphAtlas.width[charArr[j]] + lineWidth : glyphAtlas.width[charArr[j]];
						this.imageHeight = image.height;
						this.imageWidth = image.width;

						if (this.images_.length === 0) {
							this.images_.push(image);
						} else {
							const currentImage = this.images_[this.images_.length - 1];
							if (getUid(currentImage) !== getUid(image)) {
								this.groupIndices.push(this.indices.length);
								this.images_.push(image);
							}
						}

						this.drawText_(flatCoordinates, offset, end, stride);
					}
					currX += this.width;
				}
			}
		}
	}

	public finish(context: WebGLContext) {
		const gl = context.getGL();

		this.groupIndices.push(this.indices.length);
		this.hitDetectionGroupIndices = this.groupIndices;

		// create, bind, and populate the vertices buffer
		this.verticesBuffer = new WebGLBuffer(this.vertices);

		// create, bind, and populate the indices buffer
		this.indicesBuffer = new WebGLBuffer(this.indices);

		// create textures
		/** @type {Object.<string, WebGLTexture>} */
		const texturePerImage = {};

		this.createTextures(this.textures_, this.images_, texturePerImage, gl);

		this.state_ = {
			fillColor: null,
			font: undefined,
			lineCap: undefined,
			lineDash: null,
			lineDashOffset: undefined,
			lineJoin: undefined,
			lineWidth: 0,
			miterLimit: undefined,
			scale: undefined,
			strokeColor: null
		};
		this.text_ = '';
		this.textAlign_ = undefined;
		this.textBaseline_ = undefined;
		this.offsetX_ = undefined;
		this.offsetY_ = undefined;
		this.images_ = null;
		this.atlases_ = {};
		this.currAtlas_ = undefined;
		WebGLTextureReplay.prototype.finish.call(this, context);
	}


	public setTextStyle(textStyle: Text, _opt_declutterGroup?: DeclutterGroup) {
		const state = this.state_;
		const textFillStyle = textStyle.getFill();
		const textStrokeStyle = textStyle.getStroke();
		if (!textStyle || !textStyle.getText() || (!textFillStyle && !textStrokeStyle)) {
			this.text_ = '';
		} else {
			if (!textFillStyle) {
				state.fillColor = null;
			} else {
				const textFillStyleColor = textFillStyle.getColor();
				state.fillColor = asColorLike(textFillStyleColor ?
					textFillStyleColor : DEFAULT_FILLSTYLE);
			}
			if (!textStrokeStyle) {
				state.strokeColor = null;
				state.lineWidth = 0;
			} else {
				const textStrokeStyleColor = textStrokeStyle.getColor();
				state.strokeColor = asColorLike(textStrokeStyleColor ?
					textStrokeStyleColor : DEFAULT_STROKESTYLE);
				state.lineWidth = textStrokeStyle.getWidth() || DEFAULT_LINEWIDTH;
				state.lineCap = textStrokeStyle.getLineCap() || DEFAULT_LINECAP;
				state.lineDashOffset = textStrokeStyle.getLineDashOffset() || DEFAULT_LINEDASHOFFSET;
				state.lineJoin = textStrokeStyle.getLineJoin() || DEFAULT_LINEJOIN;
				state.miterLimit = textStrokeStyle.getMiterLimit() || DEFAULT_MITERLIMIT;
				const lineDash = textStrokeStyle.getLineDash();
				state.lineDash = lineDash ? lineDash.slice() : DEFAULT_LINEDASH;
			}
			state.font = textStyle.getFont() || DEFAULT_FONT;
			state.scale = textStyle.getScale() || 1;
			this.text_ = (textStyle.getText());
			const textAlign = TEXT_ALIGN[textStyle.getTextAlign() as any] as any as TEXT_ALIGN;
			const textBaseline = TEXT_ALIGN[textStyle.getTextBaseline() as any] as any as TEXT_ALIGN;
			this.textAlign_ = textAlign === undefined ?
				DEFAULT_TEXTALIGN : textAlign;
			this.textBaseline_ = textBaseline === undefined ?
				DEFAULT_TEXTBASELINE : textBaseline;
			this.offsetX_ = textStyle.getOffsetX() || 0;
			this.offsetY_ = textStyle.getOffsetY() || 0;
			this.rotateWithView = !!textStyle.getRotateWithView();
			this.rotation = textStyle.getRotation() || 0;

			this.currAtlas_ = this.getAtlas_(state);
		}
	}

	protected getTextures(_opt_all?: boolean): WebGLTexture[] {
		return this.textures_;
	}

	protected getHitDetectionTextures(): WebGLTexture[] {
		return this.textures_;
	}

	/**
	 * @private
	 * @param {Array.<string>} lines Label to draw split to lines.
	 * @return {Array.<number>} Size of the label in pixels.
	 */
	private getTextSize_(lines: string[]) {
		const self = this;
		const glyphAtlas = this.currAtlas_;
		const textHeight = lines.length * glyphAtlas.height;
		// Split every line to an array of chars, sum up their width, and select the longest.
		const textWidth = lines.map((str) => {
			let sum = 0;
			for (let i = 0, ii = str.length; i < ii; ++i) {
				const curr = str[i];
				if (!glyphAtlas.width[curr]) {
					self.addCharToAtlas_(curr);
				}
				sum += glyphAtlas.width[curr] ? glyphAtlas.width[curr] : 0;
			}
			return sum;
		}).reduce((max, curr) => {
			return Math.max(max, curr);
		});

		return [textWidth, textHeight];
	}

	/**
	 * @private
	 * @param {Array.<number>} flatCoordinates Flat coordinates.
	 * @param {number} offset Offset.
	 * @param {number} end End.
	 * @param {number} stride Stride.
	 */
	private drawText_(flatCoordinates: number[], offset: number, end: number, stride: number) {
		for (let i = offset, ii = end; i < ii; i += stride) {
			this.drawCoordinates(flatCoordinates, offset, end, stride);
		}
	}

	/**
	 * @private
	 * @param {string} char Character.
	 */
	private addCharToAtlas_(char: string) {
		if (char.length === 1) {
			const glyphAtlas = this.currAtlas_;
			const state = this.state_;
			const mCtx = this.measureCanvas_.getContext('2d');
			mCtx.font = state.font;
			const width = Math.ceil(mCtx.measureText(char).width * state.scale);

			const info = glyphAtlas.atlas.add(char, width, glyphAtlas.height, (ctx, x, y) => {
				// Parameterize the canvas
				ctx.font = state.font;
				ctx.fillStyle = state.fillColor;
				ctx.strokeStyle = state.strokeColor;
				ctx.lineWidth = state.lineWidth;
				ctx.lineCap = /*** @type {string} */ (state.lineCap);
				ctx.lineJoin = /** @type {string} */ (state.lineJoin);
				ctx.miterLimit = /** @type {number} */ (state.miterLimit);
				ctx.textAlign = 'left';
				ctx.textBaseline = 'top';
				if (CANVAS_LINE_DASH && state.lineDash) {
					// FIXME: use pixelRatio
					ctx.setLineDash(state.lineDash);
					ctx.lineDashOffset = /** @type {number} */ (state.lineDashOffset);
				}
				if (state.scale !== 1) {
					// FIXME: use pixelRatio
					ctx.setTransform(/** @type {number} */(state.scale), 0, 0,
						/** @type {number} */(state.scale), 0, 0);
				}

				// Draw the character on the canvas
				if (state.strokeColor) {
					ctx.strokeText(char, x, y);
				}
				if (state.fillColor) {
					ctx.fillText(char, x, y);
				}
			});

			if (info) {
				glyphAtlas.width[char] = width;
			}
		}
	}

	/**
	 * @private
	 * @param {Object} state Font attributes.
	 * @return {module:ol/render/webgl/TextReplay~GlyphAtlas} Glyph atlas.
	 */
	private getAtlas_(state: { [key: string]: string | number | ColorLike | Array<string | number | ColorLike>; }) {
		let params = [] as Array<string | number>;
		for (const i in state) {
			if (state[i] || state[i] === 0) {
				if (Array.isArray(state[i])) {
					params = params.concat(state[i] as number[]);
				} else {
					params.push(state[i] as string | number);
				}
			}
		}
		const hash = this.calculateHash_(params);
		if (!this.atlases_[hash]) {
			const mCtx = this.measureCanvas_.getContext('2d');
			mCtx.font = state.font as string;
			const height = Math.ceil((mCtx.measureText('M').width * 1.5 + (state.lineWidth as number) / 2) * (state.scale as number));

			this.atlases_[hash] = {
				atlas: new AtlasManager({
					space: (state.lineWidth as number) + 1
				}),
				height,
				width: {}
			};
		}
		return this.atlases_[hash];
	}

	/**
	 * @private
	 * @param {Array.<string|number>} params Array of parameters.
	 * @return {string} Hash string.
	 */
	private calculateHash_(params: Array<string | number>) {
		// TODO: Create a more performant, reliable, general hash function.
		let hash = '';
		for (let i = 0, ii = params.length; i < ii; ++i) {
			hash += params[i];
		}
		return hash;
	}
}
