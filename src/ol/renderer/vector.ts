/**
 * @module ol/renderer/vector
 */
import Event from '../events/Event';
import Feature from '../Feature';
import Circle from '../geom/Circle';
import Geometry from '../geom/Geometry';
import GeometryCollection from '../geom/GeometryCollection';
import GeometryType from '../geom/GeometryType';
import LineString from '../geom/LineString';
import MultiLineString from '../geom/MultiLineString';
import MultiPoint from '../geom/MultiPoint';
import MultiPolygon from '../geom/MultiPolygon';
import Point from '../geom/Point';
import Polygon from '../geom/Polygon';
import SimpleGeometry from '../geom/SimpleGeometry';
import ImageState from '../ImageState';
import { getUid } from '../index';
import RenderFeature from '../render/Feature';
import ReplayGroup from '../render/ReplayGroup';
import ReplayType from '../render/ReplayType';
import Style from '../style/Style';


/**
 * Tolerance for geometry simplification in device pixels.
 * @type {number}
 */
const SIMPLIFY_TOLERANCE = 0.5;


/**
 * @const
 * @type {Object.<module:ol/geom/GeometryType,
 *                function(module:ol/render/ReplayGroup, module:ol/geom/Geometry,
 *                         module:ol/style/Style, Object)>}
 */
const GEOMETRY_RENDERERS = {
	Circle: renderCircleGeometry,
	GeometryCollection: renderGeometryCollectionGeometry,
	LineString: renderLineStringGeometry,
	MultiLineString: renderMultiLineStringGeometry,
	MultiPoint: renderMultiPointGeometry,
	MultiPolygon: renderMultiPolygonGeometry,
	Point: renderPointGeometry,
	Polygon: renderPolygonGeometry
} as {
		[type: string]: any;
	};


/**
 * @param {module:ol/Feature|module:ol/render/Feature} feature1 Feature 1.
 * @param {module:ol/Feature|module:ol/render/Feature} feature2 Feature 2.
 * @return {number} Order.
 */
export function defaultOrder(feature1: Feature | RenderFeature, feature2: Feature | RenderFeature) {
	return getUid(feature1) - getUid(feature2);
}


/**
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @return {number} Squared pixel tolerance.
 */
export function getSquaredTolerance(resolution: number, pixelRatio: number) {
	const tolerance = getTolerance(resolution, pixelRatio);
	return tolerance * tolerance;
}


/**
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @return {number} Pixel tolerance.
 */
export function getTolerance(resolution: number, pixelRatio: number) {
	return SIMPLIFY_TOLERANCE * resolution / pixelRatio;
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/Circle} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature} feature Feature.
 */
function renderCircleGeometry(replayGroup: ReplayGroup, geometry: Circle, style: Style, feature: Feature) {
	const fillStyle = style.getFill();
	const strokeStyle = style.getStroke();
	if (fillStyle || strokeStyle) {
		const circleReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.CIRCLE);
		circleReplay.setFillStrokeStyle(fillStyle, strokeStyle);
		circleReplay.drawCircle(geometry, feature);
	}
	const textStyle = style.getText();
	if (textStyle) {
		const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
		textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
		textReplay.drawText(geometry, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 * @param {module:ol/style/Style} style Style.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {function(this: T, module:ol/events/Event)} listener Listener function.
 * @param {T} thisArg Value to use as `this` when executing `listener`.
 * @return {boolean} `true` if style is loading.
 * @template T
 */
export function renderFeature<T>(replayGroup: ReplayGroup, feature: Feature | RenderFeature, style: Style, squaredTolerance: number, listener: (this: T, event: Event) => void, thisArg?: T) {
	let loading = false;
	const imageStyle = style.getImage();
	if (imageStyle) {
		let imageState = imageStyle.getImageState();
		if (imageState === ImageState.LOADED || imageState === ImageState.ERROR) {
			imageStyle.unlistenImageChange(listener, thisArg);
		} else {
			if (imageState === ImageState.IDLE) {
				imageStyle.load();
			}
			imageState = imageStyle.getImageState();
			imageStyle.listenImageChange<T>(listener, thisArg);
			loading = true;
		}
	}
	renderFeatureInternal(replayGroup, feature, style, squaredTolerance);

	return loading;
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 * @param {module:ol/style/Style} style Style.
 * @param {number} squaredTolerance Squared tolerance.
 */
function renderFeatureInternal(replayGroup: ReplayGroup, feature: Feature | RenderFeature, style: Style, squaredTolerance: number) {
	const geometry = style.getGeometryFunction()(feature) as SimpleGeometry;
	if (!geometry) {
		return;
	}
	const simplifiedGeometry = geometry.getSimplifiedGeometry(squaredTolerance);
	const renderer = style.getRenderer();
	if (renderer) {
		renderGeometry(replayGroup, simplifiedGeometry, style, feature);
	} else {
		const geometryRenderer = GEOMETRY_RENDERERS[simplifiedGeometry.getType()];
		geometryRenderer(replayGroup, simplifiedGeometry, style, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/Geometry} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 */
function renderGeometry(replayGroup: ReplayGroup, geometry: Geometry, style: Style, feature: Feature | RenderFeature) {
	if (geometry.getType() === GeometryType.GEOMETRY_COLLECTION) {
		const geometries = (geometry as GeometryCollection).getGeometries();
		for (let i = 0, ii = geometries.length; i < ii; ++i) {
			renderGeometry(replayGroup, geometries[i], style, feature);
		}
		return;
	}
	const replay = replayGroup.getReplay(style.getZIndex(), ReplayType.DEFAULT);
	replay.drawCustom((geometry as SimpleGeometry), feature, style.getRenderer());
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/GeometryCollection} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature} feature Feature.
 */
function renderGeometryCollectionGeometry(replayGroup: ReplayGroup, geometry: GeometryCollection, style: Style, feature: Feature | RenderFeature) {
	const geometries = geometry.getGeometriesArray();
	for (let i = 0, ii = geometries.length; i < ii; ++i) {
		const geometryRenderer =
			GEOMETRY_RENDERERS[geometries[i].getType()];
		geometryRenderer(replayGroup, geometries[i], style, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/LineString|module:ol/render/Feature} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 */
function renderLineStringGeometry(replayGroup: ReplayGroup, geometry: LineString | RenderFeature, style: Style, feature: Feature | RenderFeature) {
	const strokeStyle = style.getStroke();
	if (strokeStyle) {
		const lineStringReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.LINE_STRING);
		lineStringReplay.setFillStrokeStyle(null, strokeStyle);
		lineStringReplay.drawLineString(geometry, feature);
	}
	const textStyle = style.getText();
	if (textStyle) {
		const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
		textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
		textReplay.drawText(geometry, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/MultiLineString|module:ol/render/Feature} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 */
function renderMultiLineStringGeometry(replayGroup: ReplayGroup, geometry: MultiLineString | RenderFeature, style: Style, feature: Feature | RenderFeature) {
	const strokeStyle = style.getStroke();
	if (strokeStyle) {
		const lineStringReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.LINE_STRING);
		lineStringReplay.setFillStrokeStyle(null, strokeStyle);
		lineStringReplay.drawMultiLineString(geometry, feature);
	}
	const textStyle = style.getText();
	if (textStyle) {
		const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
		textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
		textReplay.drawText(geometry, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/MultiPolygon} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature} feature Feature.
 */
function renderMultiPolygonGeometry(replayGroup: ReplayGroup, geometry: MultiPolygon, style: Style, feature: Feature) {
	const fillStyle = style.getFill();
	const strokeStyle = style.getStroke();
	if (strokeStyle || fillStyle) {
		const polygonReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.POLYGON);
		polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
		polygonReplay.drawMultiPolygon(geometry, feature);
	}
	const textStyle = style.getText();
	if (textStyle) {
		const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
		textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
		textReplay.drawText(geometry, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/Point|module:ol/render/Feature} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 */
function renderPointGeometry(replayGroup: ReplayGroup, geometry: Point | RenderFeature, style: Style, feature: Feature | RenderFeature) {
	const imageStyle = style.getImage();
	if (imageStyle) {
		if (imageStyle.getImageState() !== ImageState.LOADED) {
			return;
		}
		const imageReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.IMAGE);
		imageReplay.setImageStyle(imageStyle, replayGroup.addDeclutter(false));
		imageReplay.drawPoint(geometry, feature);
	}
	const textStyle = style.getText();
	if (textStyle) {
		const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
		textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(!!imageStyle));
		textReplay.drawText(geometry, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/MultiPoint|module:ol/render/Feature} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 */
function renderMultiPointGeometry(replayGroup: ReplayGroup, geometry: MultiPoint | RenderFeature, style: Style, feature: Feature | RenderFeature) {
	const imageStyle = style.getImage();
	if (imageStyle) {
		if (imageStyle.getImageState() !== ImageState.LOADED) {
			return;
		}
		const imageReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.IMAGE);
		imageReplay.setImageStyle(imageStyle, replayGroup.addDeclutter(false));
		imageReplay.drawMultiPoint(geometry, feature);
	}
	const textStyle = style.getText();
	if (textStyle) {
		const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
		textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(!!imageStyle));
		textReplay.drawText(geometry, feature);
	}
}


/**
 * @param {module:ol/render/ReplayGroup} replayGroup Replay group.
 * @param {module:ol/geom/Polygon|module:ol/render/Feature} geometry Geometry.
 * @param {module:ol/style/Style} style Style.
 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
 */
function renderPolygonGeometry(replayGroup: ReplayGroup, geometry: Polygon | RenderFeature, style: Style, feature: Feature | RenderFeature) {
	const fillStyle = style.getFill();
	const strokeStyle = style.getStroke();
	if (fillStyle || strokeStyle) {
		const polygonReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.POLYGON);
		polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
		polygonReplay.drawPolygon(geometry, feature);
	}
	const textStyle = style.getText();
	if (textStyle) {
		const textReplay = replayGroup.getReplay(style.getZIndex(), ReplayType.TEXT);
		textReplay.setTextStyle(textStyle, replayGroup.addDeclutter(false));
		textReplay.drawText(geometry, feature);
	}
}
