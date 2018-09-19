/**
 * @module ol/renderer/webgl/Map
 */

import { stableSort } from '../../array';
import { CLASS_UNSELECTABLE } from '../../css';
import { createCanvasContext2D } from '../../dom';
import { listen } from '../../events';
import Layer, { visibleAtResolution } from '../../layer/Layer';
import RenderEvent from '../../render/Event';
import RenderEventType from '../../render/EventType';
import WebGLImmediateRenderer from '../../render/webgl/Immediate';
import SourceState from '../../source/State';
import LRUCache from '../../structs/LRUCache';
import PriorityQueue from '../../structs/PriorityQueue';
import {
	BLEND, CLAMP_TO_EDGE, COLOR_BUFFER_BIT, CULL_FACE, DEPTH_TEST, FRAMEBUFFER,
	getContext, LINEAR, ONE, ONE_MINUS_SRC_ALPHA, RGBA, SCISSOR_TEST, SRC_ALPHA,
	STENCIL_TEST, TEXTURE0, TEXTURE_2D, TEXTURE_MAG_FILTER, TEXTURE_MIN_FILTER,
	TEXTURE_WRAP_S, TEXTURE_WRAP_T, UNSIGNED_BYTE
} from '../../webgl';
import WebGLContext from '../../webgl/Context';
import ContextEventType from '../../webgl/ContextEventType';
import MapRenderer, { sortByZIndex } from '../Map';
import PluggableMap, { FrameState, PostRenderFunction } from '../../PluggableMap';
import Tile from '../../Tile';
import { Coordinate } from '../../coordinate';
import { Size } from '../../size';
import EventType from '../../render/EventType';
import Event from '../../events/Event';
import { Pixel } from '../../index';
import Feature from '../../Feature';
import RenderFeature from '../../render/Feature';

/**
 * @typedef {Object} TextureCacheEntry
 * @property {number} magFilter
 * @property {number} minFilter
 * @property {WebGLTexture} texture
 */
export interface TextureCacheEntry {
	magFilter: number;
	minFilter: number;
	texture: WebGLTexture;
}

/**
 * Texture cache high water mark.
 * @type {number}
 */
const WEBGL_TEXTURE_CACHE_HIGH_WATER_MARK = 1024;


/**
 * @constructor
 * @extends {module:ol/renderer/Map}
 * @param {module:ol/PluggableMap} map Map.
 * @api
 */
export default class WebGLMapRenderer extends MapRenderer {
	private canvas_: HTMLCanvasElement;
	private clipTileCanvasWidth_: number;
	private clipTileCanvasHeight_: number;
	private clipTileContext_: CanvasRenderingContext2D;
	private renderedVisible_: boolean;
	private gl_: WebGLRenderingContext;
	private context_: WebGLContext;
	private textureCache_: LRUCache<TextureCacheEntry>;
	private focus_: Coordinate | null;
	private tileTextureQueue_: PriorityQueue<any[]>;
	private textureCacheFrameMarkerCount_: number;
	private loadNextTileTexture_: (_map: PluggableMap, _frameState: FrameState) => boolean;
	constructor(map: PluggableMap) {
		super(map);

		const container = map.getViewport();

		/**
		 * @private
		 * @type {HTMLCanvasElement}
		 */
		this.canvas_ = /** @type {HTMLCanvasElement} */
			(document.createElement('canvas'));
		this.canvas_.style.width = '100%';
		this.canvas_.style.height = '100%';
		this.canvas_.style.display = 'block';
		this.canvas_.className = CLASS_UNSELECTABLE;
		container.insertBefore(this.canvas_, container.childNodes[0] || null);

		/**
		 * @private
		 * @type {number}
		 */
		this.clipTileCanvasWidth_ = 0;

		/**
		 * @private
		 * @type {number}
		 */
		this.clipTileCanvasHeight_ = 0;

		/**
		 * @private
		 * @type {CanvasRenderingContext2D}
		 */
		this.clipTileContext_ = createCanvasContext2D();

		/**
		 * @private
		 * @type {boolean}
		 */
		this.renderedVisible_ = true;

		/**
		 * @private
		 * @type {WebGLRenderingContext}
		 */
		this.gl_ = getContext(this.canvas_, {
			antialias: true,
			depth: true,
			failIfMajorPerformanceCaveat: true,
			preserveDrawingBuffer: false,
			stencil: true
		});

		/**
		 * @private
		 * @type {module:ol/webgl/Context}
		 */
		this.context_ = new WebGLContext(this.canvas_, this.gl_);

		listen(this.canvas_, ContextEventType.LOST,
			this.handleWebGLContextLost, this);
		listen(this.canvas_, ContextEventType.RESTORED,
			this.handleWebGLContextRestored, this);

		/**
		 * @private
		 * @type {module:ol/structs/LRUCache.<module:ol/renderer/webgl/Map~TextureCacheEntry|null>}
		 */
		this.textureCache_ = new LRUCache<TextureCacheEntry>();

		/**
		 * @private
		 * @type {module:ol/coordinate~Coordinate}
		 */
		this.focus_ = null;

		/**
		 * @private
		 * @type {module:ol/structs/PriorityQueue.<Array>}
		 */
		this.tileTextureQueue_ = new PriorityQueue(
			/**
			 * @param {Array.<*>} element Element.
			 * @return {number} Priority.
			 * @this {module:ol/renderer/webgl/Map}
			 */
			(element) => {
				const tileCenter = /** @type {module:ol/coordinate~Coordinate} */ (element[1]);
				const tileResolution = /** @type {number} */ (element[2]);
				const deltaX = tileCenter[0] - this.focus_[0];
				const deltaY = tileCenter[1] - this.focus_[1];
				return 65536 * Math.log(tileResolution) +
					Math.sqrt(deltaX * deltaX + deltaY * deltaY) / tileResolution;
			},
			/**
			 * @param {Array.<*>} element Element.
			 * @return {string} Key.
			 */
			(element: any[]) => {
				return (element[0] as Tile).getKey();
			});

		/**
		 * @param {module:ol/PluggableMap} map Map.
		 * @param {?module:ol/PluggableMap~FrameState} frameState Frame state.
		 * @return {boolean} false.
		 * @this {module:ol/renderer/webgl/Map}
		 */
		this.loadNextTileTexture_ =
			(_map: PluggableMap, _frameState: FrameState) => {
				if (!this.tileTextureQueue_.isEmpty()) {
					this.tileTextureQueue_.reprioritize();
					const element = this.tileTextureQueue_.dequeue();
					const tile = /** @type {module:ol/Tile} */ (element[0]);
					const tileSize = /** @type {module:ol/size~Size} */ (element[3]);
					const tileGutter = /** @type {number} */ (element[4]);
					this.bindTileTexture(
						tile, tileSize, tileGutter, LINEAR, LINEAR);
				}
				return false;
			};


		/**
		 * @private
		 * @type {number}
		 */
		this.textureCacheFrameMarkerCount_ = 0;

		this.initializeGL_();
	}

	/**
	 * @param {module:ol/Tile} tile Tile.
	 * @param {module:ol/size~Size} tileSize Tile size.
	 * @param {number} tileGutter Tile gutter.
	 * @param {number} magFilter Mag filter.
	 * @param {number} minFilter Min filter.
	 */
	public bindTileTexture(tile: Tile, tileSize: Size, tileGutter: number, magFilter: number, minFilter: number) {
		const gl = this.getGL();
		const tileKey = tile.getKey();
		if (this.textureCache_.containsKey(tileKey)) {
			const textureCacheEntry = this.textureCache_.get(tileKey);
			gl.bindTexture(TEXTURE_2D, textureCacheEntry.texture);
			if (textureCacheEntry.magFilter !== magFilter) {
				gl.texParameteri(
					TEXTURE_2D, TEXTURE_MAG_FILTER, magFilter);
				textureCacheEntry.magFilter = magFilter;
			}
			if (textureCacheEntry.minFilter !== minFilter) {
				gl.texParameteri(
					TEXTURE_2D, TEXTURE_MIN_FILTER, minFilter);
				textureCacheEntry.minFilter = minFilter;
			}
		} else {
			const texture = gl.createTexture();
			gl.bindTexture(TEXTURE_2D, texture);
			if (tileGutter > 0) {
				const clipTileCanvas = this.clipTileContext_.canvas;
				const clipTileContext = this.clipTileContext_;
				if (this.clipTileCanvasWidth_ !== tileSize[0] ||
					this.clipTileCanvasHeight_ !== tileSize[1]) {
					clipTileCanvas.width = tileSize[0];
					clipTileCanvas.height = tileSize[1];
					this.clipTileCanvasWidth_ = tileSize[0];
					this.clipTileCanvasHeight_ = tileSize[1];
				} else {
					clipTileContext.clearRect(0, 0, tileSize[0], tileSize[1]);
				}
				clipTileContext.drawImage(tile.getImage(), tileGutter, tileGutter,
					tileSize[0], tileSize[1], 0, 0, tileSize[0], tileSize[1]);
				gl.texImage2D(TEXTURE_2D, 0,
					RGBA, RGBA,
					UNSIGNED_BYTE, clipTileCanvas);
			} else {
				gl.texImage2D(TEXTURE_2D, 0,
					RGBA, RGBA,
					UNSIGNED_BYTE, tile.getImage());
			}
			gl.texParameteri(
				TEXTURE_2D, TEXTURE_MAG_FILTER, magFilter);
			gl.texParameteri(
				TEXTURE_2D, TEXTURE_MIN_FILTER, minFilter);
			gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S,
				CLAMP_TO_EDGE);
			gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T,
				CLAMP_TO_EDGE);
			this.textureCache_.set(tileKey, {
				magFilter,
				minFilter,
				texture
			});
		}
	}

	/**
	 * @return {module:ol/webgl/Context} The context.
	 */
	public getContext() {
		return this.context_;
	}

	/**
	 * @return {WebGLRenderingContext} GL.
	 */
	public getGL() {
		return this.gl_;
	}


	/**
	 * @return {module:ol/structs/PriorityQueue.<Array>} Tile texture queue.
	 */
	public getTileTextureQueue() {
		return this.tileTextureQueue_;
	}

	/**
	 * @param {module:ol/Tile} tile Tile.
	 * @return {boolean} Is tile texture loaded.
	 */
	public isTileTextureLoaded(tile: Tile) {
		return this.textureCache_.containsKey(tile.getKey());
	}


	/**
	 * @inheritDoc
	 */
	public renderFrame(frameState: FrameState | undefined | null) {
		const context = this.getContext();
		const gl = this.getGL();

		if (gl.isContextLost()) {
			return false;
		}

		if (!frameState) {
			if (this.renderedVisible_) {
				this.canvas_.style.display = 'none';
				this.renderedVisible_ = false;
			}
			return false;
		}

		this.focus_ = frameState.focus;

		this.textureCache_.set((-frameState.index).toString(), null);
		++this.textureCacheFrameMarkerCount_;

		this.dispatchComposeEvent_(RenderEventType.PRECOMPOSE, frameState);

		/** @type {Array.<module:ol/layer/Layer~State>} */
		const layerStatesToDraw = [];
		const layerStatesArray = frameState.layerStatesArray;
		stableSort(layerStatesArray, sortByZIndex);

		const viewResolution = frameState.viewState.resolution;
		for (let i = 0, ii = layerStatesArray.length; i < ii; ++i) {
			const layerState = layerStatesArray[i];
			if (visibleAtResolution(layerState, viewResolution) &&
				layerState.sourceState === SourceState.READY) {
				const layerRenderer = /** @type {module:ol/renderer/webgl/Layer} */ (this.getLayerRenderer(layerState.layer) as webglLayer);
				if (layerRenderer.prepareFrame(frameState, layerState, context)) {
					layerStatesToDraw.push(layerState);
				}
			}
		}

		const width = frameState.size[0] * frameState.pixelRatio;
		const height = frameState.size[1] * frameState.pixelRatio;
		if (this.canvas_.width !== width || this.canvas_.height !== height) {
			this.canvas_.width = width;
			this.canvas_.height = height;
		}

		gl.bindFramebuffer(FRAMEBUFFER, null);

		gl.clearColor(0, 0, 0, 0);
		gl.clear(COLOR_BUFFER_BIT);
		gl.enable(BLEND);
		gl.viewport(0, 0, this.canvas_.width, this.canvas_.height);

		for (let i = 0, ii = layerStatesToDraw.length; i < ii; ++i) {
			const layerState = layerStatesToDraw[i];
			const layerRenderer = /** @type {module:ol/renderer/webgl/Layer} */ (this.getLayerRenderer(layerState.layer) as webglLayer);
			layerRenderer.composeFrame(frameState, layerState, context);
		}

		if (!this.renderedVisible_) {
			this.canvas_.style.display = '';
			this.renderedVisible_ = true;
		}

		this.calculateMatrices2D(frameState);

		if (this.textureCache_.getCount() - this.textureCacheFrameMarkerCount_ >
			WEBGL_TEXTURE_CACHE_HIGH_WATER_MARK) {
			frameState.postRenderFunctions.push(this.expireCache_.bind(this) as PostRenderFunction);
		}

		if (!this.tileTextureQueue_.isEmpty()) {
			frameState.postRenderFunctions.push(this.loadNextTileTexture_);
			frameState.animate = true;
		}

		this.dispatchComposeEvent_(RenderEventType.POSTCOMPOSE, frameState);

		this.scheduleRemoveUnusedLayerRenderers(frameState);
		this.scheduleExpireIconCache(frameState);
		return true;	// todo did not return in js
	}

	/**
	 * @inheritDoc
	 */
	public forEachFeatureAtCoordinate<S, T, U>(coordinate: Coordinate, frameState: FrameState, hitTolerance: number, callback: (this: S, feature: Feature | RenderFeature, layer: Layer) => T, thisArg: S, layerFilter: (this: U, layer: Layer) => boolean, thisArg2: U) {
		let result;

		if (this.getGL().isContextLost()) {
			return false;
		}

		const viewState = frameState.viewState;

		const layerStates = frameState.layerStatesArray;
		const numLayers = layerStates.length;
		let i;
		for (i = numLayers - 1; i >= 0; --i) {
			const layerState = layerStates[i];
			const layer = layerState.layer;
			if (visibleAtResolution(layerState, viewState.resolution) &&
				layerFilter.call(thisArg2, layer)) {
				const layerRenderer = this.getLayerRenderer(layer);
				result = layerRenderer.forEachFeatureAtCoordinate(
					coordinate, frameState, hitTolerance, callback, thisArg);
				if (result) {
					return result;
				}
			}
		}
		return undefined;
	}


	/**
	 * @inheritDoc
	 */
	public hasFeatureAtCoordinate<U>(coordinate: Coordinate, frameState: FrameState, _hitTolerance: number, layerFilter: (this: U, layer: Layer) => boolean, thisArg: U) {
		let hasFeature = false;

		if (this.getGL().isContextLost()) {
			return false;
		}

		const viewState = frameState.viewState;

		const layerStates = frameState.layerStatesArray;
		const numLayers = layerStates.length;
		let i;
		for (i = numLayers - 1; i >= 0; --i) {
			const layerState = layerStates[i];
			const layer = layerState.layer;
			if (visibleAtResolution(layerState, viewState.resolution) &&
				layerFilter.call(thisArg, layer)) {
				const layerRenderer = this.getLayerRenderer(layer);
				hasFeature =
					layerRenderer.hasFeatureAtCoordinate(coordinate, frameState);
				if (hasFeature) {
					return true;
				}
			}
		}
		return hasFeature;
	}

	/**
	 * @inheritDoc
	 */
	public forEachLayerAtPixel<S, T, U>(pixel: Pixel, frameState: FrameState, callback: (this: S, layer: Layer, data: (Uint8ClampedArray | Uint8Array)) => T, thisArg: S, layerFilter: (this: U, layer: Layer) => boolean, _thisArg2: U): T | undefined | void {
		if (this.getGL().isContextLost()) {
			return false as any as T;
		}

		const viewState = frameState.viewState;
		let result;

		const layerStates = frameState.layerStatesArray;
		const numLayers = layerStates.length;
		let i;
		for (i = numLayers - 1; i >= 0; --i) {
			const layerState = layerStates[i];
			const layer = layerState.layer;
			if (visibleAtResolution(layerState, viewState.resolution) &&
				layerFilter.call(thisArg, layer)) {
				const layerRenderer = /** @type {module:ol/renderer/webgl/Layer} */ (this.getLayerRenderer(layer) as webglLayer);
				result = layerRenderer.forEachLayerAtPixel(
					pixel, frameState, callback, thisArg);
				if (result) {
					return result;
				}
			}
		}
		return undefined;
	}

	/**
	 * @param {module:ol/events/Event} event Event.
	 * @protected
	 */
	protected handleWebGLContextLost(event: Event) {
		event.preventDefault();
		this.textureCache_.clear();
		this.textureCacheFrameMarkerCount_ = 0;

		const renderers = this.getLayerRenderers();
		Object.keys(renderers).forEach((id) => {
			const renderer = /** @type {module:ol/renderer/webgl/Layer} */ (renderers[id] as webglLayer);
			renderer.handleWebGLContextLost();
		});
	}


	/**
	 * @protected
	 */
	protected handleWebGLContextRestored() {
		this.initializeGL_();
		this.getMap().render();
	}

	/**
	 * @param {module:ol/render/EventType} type Event type.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @private
	 */
	private dispatchComposeEvent_(type: EventType, frameState: FrameState) {
		const map = this.getMap();
		if (map.hasListener(type)) {
			const context = this.context_;

			const extent = frameState.extent;
			const size = frameState.size;
			const viewState = frameState.viewState;
			const pixelRatio = frameState.pixelRatio;

			const resolution = viewState.resolution;
			const center = viewState.center;
			const rotation = viewState.rotation;

			const vectorContext = new WebGLImmediateRenderer(context,
				center, resolution, rotation, size, extent, pixelRatio);
			const composeEvent = new RenderEvent(type, vectorContext,
				frameState, null, context);
			map.dispatchEvent(composeEvent);
		}
	}


	/**
	 * @inheritDoc
	 */
	private disposeInternal() {
		const gl = this.getGL();
		if (!gl.isContextLost()) {
			this.textureCache_.forEach(
				/**
				 * @param {?module:ol/renderer/webgl/Map~TextureCacheEntry} textureCacheEntry
				 *     Texture cache entry.
				 */
				(textureCacheEntry) => {
					if (textureCacheEntry) {
						gl.deleteTexture(textureCacheEntry.texture);
					}
				});
		}
		this.context_.dispose();
		MapRenderer.prototype.disposeInternal.call(this);
	}


	/**
	 * @param {module:ol/PluggableMap} map Map.
	 * @param {module:ol/PluggableMap~FrameState} frameState Frame state.
	 * @private
	 */
	private expireCache_(map: PluggableMap, frameState: FrameState) {
		const gl = this.getGL();
		let textureCacheEntry;
		while (this.textureCache_.getCount() - this.textureCacheFrameMarkerCount_ >
			WEBGL_TEXTURE_CACHE_HIGH_WATER_MARK) {
			textureCacheEntry = this.textureCache_.peekLast();
			if (!textureCacheEntry) {
				if (+this.textureCache_.peekLastKey() === frameState.index) {
					break;
				} else {
					--this.textureCacheFrameMarkerCount_;
				}
			} else {
				gl.deleteTexture(textureCacheEntry.texture);
			}
			this.textureCache_.pop();
		}
	}

	/**
	 * @private
	 */
	private initializeGL_() {
		const gl = this.gl_;
		gl.activeTexture(TEXTURE0);
		gl.blendFuncSeparate(
			SRC_ALPHA, ONE_MINUS_SRC_ALPHA,
			ONE, ONE_MINUS_SRC_ALPHA);
		gl.disable(CULL_FACE);
		gl.disable(DEPTH_TEST);
		gl.disable(SCISSOR_TEST);
		gl.disable(STENCIL_TEST);
	}
}
