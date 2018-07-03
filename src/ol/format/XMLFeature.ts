/**
 * @module ol/format/XMLFeature
 */
import { extend } from '../array';
import Feature from '../Feature';
import FeatureFormat, { ReadOptions, WriteOptions } from '../format/Feature';
import FormatType from '../format/FormatType';
import Geometry from '../geom/Geometry';
import Projection from '../proj/Projection';
import { isDocument, isNode, parse } from '../xml';

/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for XML feature formats.
 *
 * @constructor
 * @abstract
 * @extends {module:ol/format/Feature}
 */
export default abstract class XMLFeature extends FeatureFormat {
	private xmlSerializer_: XMLSerializer;
	constructor() {
		super();
		/**
		 * @type {XMLSerializer}
		 * @private
		 */
		this.xmlSerializer_ = new XMLSerializer();
	}

	/**
	 * @inheritDoc
	 */
	public getType() {
		return FormatType.XML;
	}


	/**
	 * @inheritDoc
	 */
	public readFeature(source: Document | Node | object | string, opt_options?: ReadOptions): Feature | null {
		if (isDocument(source)) {
			return this.readFeatureFromDocument(/** @type {Document} */(source as Document), opt_options);
		} else if (isNode(source)) {
			return this.readFeatureFromNode(/** @type {Node} */(source as Node), opt_options);
		} else if (typeof source === 'string') {
			const doc = parse(source);
			return this.readFeatureFromDocument(doc, opt_options);
		} else {
			return null;
		}
	}


	/**
	 * @param {Document} doc Document.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Options.
	 * @return {module:ol/Feature} Feature.
	 */
	public readFeatureFromDocument(doc: Document, opt_options?: ReadOptions) {
		const features = this.readFeaturesFromDocument(doc, opt_options);
		if (features.length > 0) {
			return features[0];
		} else {
			return null;
		}
	}


	/**
	 * @param {Node} node Node.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Options.
	 * @return {module:ol/Feature} Feature.
	 */
	public readFeatureFromNode(_node: Node, _opt_options?: ReadOptions): Feature | null {
		return null; // not implemented
	}

	/**
	 * @inheritDoc
	 */
	public readGeometry(source: Document | Node | object | string, opt_options?: ReadOptions): Geometry | null {
		if (isDocument(source)) {
			return this.readGeometryFromDocument(
			/** @type {Document} */(source as Document), opt_options);
		} else if (isNode(source)) {
			return this.readGeometryFromNode(/** @type {Node} */(source as Node), opt_options);
		} else if (typeof source === 'string') {
			const doc = parse(source);
			return this.readGeometryFromDocument(doc, opt_options);
		} else {
			return null;
		}
	}

	/**
	 * @inheritDoc
	 */
	public readProjection(source: Document | Node | object | string): Projection | null {
		if (isDocument(source)) {
			return this.readProjectionFromDocument(/** @type {Document} */(source as Document));
		} else if (isNode(source)) {
			return this.readProjectionFromNode(/** @type {Node} */(source as Node));
		} else if (typeof source === 'string') {
			const doc = parse(source);
			return this.readProjectionFromDocument(doc);
		} else {
			return null;
		}
	}

	/**
	 * @inheritDoc
	 */
	public writeFeature(feature: Feature, opt_options?: WriteOptions): string {
		const node = this.writeFeatureNode(feature, opt_options);
		return this.xmlSerializer_.serializeToString(node!);
	}

	/**
	 * @inheritDoc
	 */
	public writeFeatures(features: Feature[], opt_options?: WriteOptions): string {
		const node = this.writeFeaturesNode(features, opt_options);
		return this.xmlSerializer_.serializeToString(node!);
	}


	/**
	 * @param {Array.<module:ol/Feature>} features Features.
	 * @param {module:ol/format/Feature~WriteOptions=} opt_options Options.
	 * @return {Node} Node.
	 */
	public writeFeaturesNode(_features: Feature[], _opt_options?: WriteOptions): Node {
		return null!; // not implemented
	}

	/**
	 * @inheritDoc
	 */
	public writeGeometry(geometry: Geometry, opt_options?: WriteOptions) {
		const node = this.writeGeometryNode(geometry, opt_options);
		return this.xmlSerializer_.serializeToString(node!);
	}


	/**
	 * @param {module:ol/geom/Geometry} geometry Geometry.
	 * @param {module:ol/format/Feature~WriteOptions=} opt_options Options.
	 * @return {Node} Node.
	 */
	public writeGeometryNode(_geometry: Geometry, _opt_options?: WriteOptions) {
		return null; // not implemented
	}


	/**
	 * @inheritDoc
	 */
	public readFeatures(source: Document | Node | object | string, opt_options?: Partial<ReadOptions>): Feature[] {
		if (isDocument(source)) {
			return this.readFeaturesFromDocument(
			/** @type {Document} */(source as Document), opt_options);
		} else if (isNode(source)) {
			return this.readFeaturesFromNode(/** @type {Node} */(source as Node), opt_options);
		} else if (typeof source === 'string') {
			const doc = parse(source);
			return this.readFeaturesFromDocument(doc, opt_options);
		} else {
			return [];
		}
	}


	/**
	 * @param {Document} doc Document.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Options.
	 * @protected
	 * @return {Array.<module:ol/Feature>} Features.
	 */
	protected readFeaturesFromDocument(doc: Document, opt_options?: Partial<ReadOptions>) {
		/** @type {Array.<module:ol/Feature>} */
		const features: Feature[] = [];
		for (let n = doc.firstChild; n; n = n.nextSibling) {
			if (n.nodeType === Node.ELEMENT_NODE) {
				extend(features, this.readFeaturesFromNode(n, opt_options));
			}
		}
		return features;
	}


	/**
	 * @abstract
	 * @param {Node} node Node.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Options.
	 * @protected
	 * @return {Array.<module:ol/Feature>} Features.
	 */
	protected abstract readFeaturesFromNode(node: Node, opt_options?: Partial<ReadOptions>): Feature[];

	/**
	 * @param {Document} doc Document.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Options.
	 * @protected
	 * @return {module:ol/geom/Geometry} Geometry.
	 */
	protected readGeometryFromDocument(_doc: Document, _opt_options?: Partial<ReadOptions>) {
		return null; // not implemented
	}

	/**
	 * @param {Node} node Node.
	 * @param {module:ol/format/Feature~ReadOptions=} opt_options Options.
	 * @protected
	 * @return {module:ol/geom/Geometry} Geometry.
	 */
	protected readGeometryFromNode(_node: Node, _opt_options?: Partial<ReadOptions>) {
		return null; // not implemented
	}

	/**
	 * @param {Document} doc Document.
	 * @protected
	 * @return {module:ol/proj/Projection} Projection.
	 */
	protected readProjectionFromDocument(_doc: Document) {
		return this.defaultDataProjection;
	}


	/**
	 * @param {Node} node Node.
	 * @protected
	 * @return {module:ol/proj/Projection} Projection.
	 */
	protected readProjectionFromNode(_node: Node) {
		return this.defaultDataProjection;
	}

	/**
	 * @param {module:ol/Feature} feature Feature.
	 * @param {module:ol/format/Feature~WriteOptions=} opt_options Options.
	 * @protected
	 * @return {Node} Node.
	 */
	protected writeFeatureNode(_feature: Feature, _opt_options?: WriteOptions) {
		return null; // not implemented
	}
}
