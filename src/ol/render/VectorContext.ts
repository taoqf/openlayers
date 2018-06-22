import Feature from '../Feature';
import Circle from '../geom/Circle';
import Geometry from '../geom/Geometry';
import GeometryCollection from '../geom/GeometryCollection';
import LineString from '../geom/LineString';
import MultiLineString from '../geom/MultiLineString';
import MultiPoint from '../geom/MultiPoint';
import MultiPolygon from '../geom/MultiPolygon';
import Point from '../geom/Point';
import Polygon from '../geom/Polygon';
import SimpleGeometry from '../geom/SimpleGeometry';
import Fill from '../style/Fill';
import Image from '../style/Image';
import Stroke from '../style/Stroke';
import Style from '../style/Style';
import Text from '../style/Text';
import RenderFeature from './Feature';

/**
 * @module ol/render/VectorContext
 */
/**
 * Context for drawing geometries.  A vector context is available on render
 * events and does not need to be constructed directly.
 * @constructor
 * @abstract
 * @struct
 * @api
 */
export default abstract class VectorContext {
	/**
	 * Render a geometry with a custom renderer.
	 *
	 * @param {module:ol/geom/SimpleGeometry} geometry Geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 * @param {Function} renderer Renderer.
	 */
	public abstract drawCustom(geometry: SimpleGeometry, feature: Feature | RenderFeature, renderer: () => void): void;

	/**
	 * Render a geometry.
	 *
	 * @param {module:ol/geom/Geometry} geometry The geometry to render.
	 */
	public abstract drawGeometry(geometry: Geometry): void;


	/**
	 * Set the rendering style.
	 *
	 * @param {module:ol/style/Style} style The rendering style.
	 */
	public abstract setStyle(style: Style): void;


	/**
	 * @param {module:ol/geom/Circle} circleGeometry Circle geometry.
	 * @param {module:ol/Feature} feature Feature.
	 */
	public abstract drawCircle(circleGeometry: Circle, feature: Feature): void;


	/**
	 * @param {module:ol/Feature} feature Feature.
	 * @param {module:ol/style/Style} style Style.
	 */
	public abstract drawFeature(feature: Feature, style: Style): void;


	/**
	 * @param {module:ol/geom/GeometryCollection} geometryCollectionGeometry Geometry
	 *     collection.
	 * @param {module:ol/Feature} feature Feature.
	 */
	public abstract drawGeometryCollection(geometryCollectionGeometry: GeometryCollection, feature: Feature): void;


	/**
	 * @param {module:ol/geom/LineString|module:ol/render/Feature} lineStringGeometry Line string geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 */
	public abstract drawLineString(lineStringGeometry: LineString | RenderFeature, feature: Feature | RenderFeature): void;


	/**
	 * @param {module:ol/geom/MultiLineString|module:ol/render/Feature} multiLineStringGeometry MultiLineString geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 */
	public abstract drawMultiLineString(multiLineStringGeometry: MultiLineString | RenderFeature, feature: Feature | RenderFeature): void;


	/**
	 * @param {module:ol/geom/MultiPoint|module:ol/render/Feature} multiPointGeometry MultiPoint geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 */
	public abstract drawMultiPoint(multiPointGeometry: MultiPoint | RenderFeature, feature: Feature | RenderFeature): void;


	/**
	 * @param {module:ol/geom/MultiPolygon} multiPolygonGeometry MultiPolygon geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 */
	public abstract drawMultiPolygon(multiPolygonGeometry: MultiPolygon, feature: Feature | RenderFeature): void;


	/**
	 * @param {module:ol/geom/Point|module:ol/render/Feature} pointGeometry Point geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 */
	public abstract drawPoint(pointGeometry: Point | RenderFeature, feature: Feature | RenderFeature): void;


	/**
	 * @param {module:ol/geom/Polygon|module:ol/render/Feature} polygonGeometry Polygon geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 */
	public abstract drawPolygon(polygonGeometry: Polygon | RenderFeature, feature: Feature | RenderFeature): void;


	/**
	 * @param {module:ol/geom/Geometry|module:ol/render/Feature} geometry Geometry.
	 * @param {module:ol/Feature|module:ol/render/Feature} feature Feature.
	 */
	public abstract drawText(geometry: Geometry | RenderFeature, feature: Feature | RenderFeature): void;


	/**
	 * @param {module:ol/style/Fill} fillStyle Fill style.
	 * @param {module:ol/style/Stroke} strokeStyle Stroke style.
	 */
	public abstract setFillStrokeStyle(fillStyle: Fill, strokeStyle: Stroke): void;


	/**
	 * @param {module:ol/style/Image} imageStyle Image style.
	 * @param {module:ol/render/canvas~DeclutterGroup=} opt_declutterGroup Declutter.
	 */
	public abstract setImageStyle(imageStyle: Image, opt_declutterGroup: DeclutterGroup): void;


	/**
	 * @param {module:ol/style/Text} textStyle Text style.
	 * @param {module:ol/render/canvas~DeclutterGroup=} opt_declutterGroup Declutter.
	 */
	public abstract setTextStyle(textStyle: Text, opt_declutterGroup: DeclutterGroup): void;
}
