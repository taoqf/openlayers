/**
 * @module ol/xml
 */
import { extend } from './array';


/**
 * When using {@link module:ol/xml~makeChildAppender} or
 * {@link module:ol/xml~makeSimpleNodeFactory}, the top `objectStack` item needs
 * to have this structure.
 * @typedef {Object} NodeStackItem
 * @property {Node} node
 */

export interface NodeStackItem {
	node: Node;
}

/**
 * @typedef {function(Node, Array.<*>)} Parser
 */

export type Parser = (n: Node, d: any[]) => void;

/**
 * @typedef {function(Node, *, Array.<*>)} Serializer
 */

export type Serializer = (n: Node, a: any, b: any[]) => void;

/**
 * This document should be used when creating nodes for XML serializations. This
 * document is also used by {@link module:ol/xml~createElementNS}
 * @const
 * @type {Document}
 */
export const DOCUMENT = document.implementation.createDocument('', '', null);


/**
 * @type {string}
 */
export const XML_SCHEMA_INSTANCE_URI = 'http://www.w3.org/2001/XMLSchema-instance';


/**
 * @param {string} namespaceURI Namespace URI.
 * @param {string} qualifiedName Qualified name.
 * @return {Node} Node.
 */
export function createElementNS(namespaceURI: string, qualifiedName: string) {
	return DOCUMENT.createElementNS(namespaceURI, qualifiedName);
}


/**
 * Recursively grab all text content of child nodes into a single string.
 * @param {Node} node Node.
 * @param {boolean} normalizeWhitespace Normalize whitespace: remove all line
 * breaks.
 * @return {string} All text content.
 * @api
 */
export function getAllTextContent(node: Node, normalizeWhitespace: boolean) {
	return getAllTextContent_(node, normalizeWhitespace, []).join('');
}


/**
 * Recursively grab all text content of child nodes into a single string.
 * @param {Node} node Node.
 * @param {boolean} normalizeWhitespace Normalize whitespace: remove all line
 * breaks.
 * @param {Array.<string>} accumulator Accumulator.
 * @private
 * @return {Array.<string>} Accumulator.
 */
export function getAllTextContent_(node: Node, normalizeWhitespace: boolean, accumulator: string[]) {
	if (node.nodeType === Node.CDATA_SECTION_NODE ||
		node.nodeType === Node.TEXT_NODE) {
		if (normalizeWhitespace) {
			accumulator.push(String(node.nodeValue).replace(/(\r\n|\r|\n)/g, ''));
		} else {
			accumulator.push(node.nodeValue as string);
		}
	} else {
		let n;
		for (n = node.firstChild; n; n = n.nextSibling) {
			getAllTextContent_(n, normalizeWhitespace, accumulator);
		}
	}
	return accumulator;
}


/**
 * @param {?} value Value.
 * @return {boolean} Is document.
 */
export function isDocument(value: any) {
	return value instanceof Document;
}


/**
 * @param {?} value Value.
 * @return {boolean} Is node.
 */
export function isNode(value: any) {
	return value instanceof Node;
}


/**
 * @param {Node} node Node.
 * @param {?string} namespaceURI Namespace URI.
 * @param {string} name Attribute name.
 * @return {string} Value
 */
export function getAttributeNS(node: Node, namespaceURI: string, name: string) {
	return (node as Element).getAttributeNS(namespaceURI, name) || '';
}


/**
 * Parse an XML string to an XML Document.
 * @param {string} xml XML.
 * @return {Document} Document.
 * @api
 */
export function parse(xml: string) {
	return new DOMParser().parseFromString(xml, 'application/xml');
}


/**
 * Make an array extender function for extending the array at the top of the
 * object stack.
 * @param {function(this: T, Node, Array.<*>): (Array.<*>|undefined)}
 *     valueReader Value reader.
 * @param {T=} opt_this The object to use as `this` in `valueReader`.
 * @return {module:ol/xml~Parser} Parser.
 * @template T
 */
export function makeArrayExtender(valueReader: (node: Node, objectStack: Node[][]) => any[] | undefined) {
	/**
	 * @param {Node} node Node.
	 * @param {Array.<*>} objectStack Object stack.
	 */
	return (node: Node, objectStack: Node[][]) => {
		const value = valueReader(node, objectStack);
		if (value !== undefined) {
			const array = /** @type {Array.<*>} */ (objectStack[objectStack.length - 1]);
			extend(array, value);
		}
	};
}


/**
 * Make an array pusher function for pushing to the array at the top of the
 * object stack.
 * @param {function(this: T, Node, Array.<*>): *} valueReader Value reader.
 * @param {T=} opt_this The object to use as `this` in `valueReader`.
 * @return {module:ol/xml~Parser} Parser.
 * @template T
 */
export function makeArrayPusher(valueReader: (node: Node, objectStack: Node[][]) => Node) {
	/**
	 * @param {Node} node Node.
	 * @param {Array.<*>} objectStack Object stack.
	 */
	return (node: Node, objectStack: Node[][]) => {
		const value = valueReader(node, objectStack);
		if (value !== undefined) {
			const array = /** @type {Array.<*>} */ (objectStack[objectStack.length - 1]);
			array.push(value);
		}
	};
}

/**
 * Make an object stack replacer function for replacing the object at the
 * top of the stack.
 * @param {function(this: T, Node, Array.<*>): *} valueReader Value reader.
 * @param {T=} opt_this The object to use as `this` in `valueReader`.
 * @return {module:ol/xml~Parser} Parser.
 * @template T
 */
export function makeReplacer(valueReader: (node: Node, objectStack: any[]) => any) {
	/**
	 * @param {Node} node Node.
	 * @param {Array.<*>} objectStack Object stack.
	 */
	return (node: Node, objectStack: any[]) => {
		const value = valueReader(node, objectStack);
		if (value !== undefined) {
			objectStack[objectStack.length - 1] = value;
		}
	};
}


/**
 * Make an object property pusher function for adding a property to the
 * object at the top of the stack.
 * @param {function(this: T, Node, Array.<*>): *} valueReader Value reader.
 * @param {string=} opt_property Property.
 * @param {T=} opt_this The object to use as `this` in `valueReader`.
 * @return {module:ol/xml~Parser} Parser.
 * @template T
 */
export function makeObjectPropertyPusher(valueReader: (node: Node, objectStack: any[]) => any, opt_property?: string) {
	/**
	 * @param {Node} node Node.
	 * @param {Array.<*>} objectStack Object stack.
	 */
	return (node: Node, objectStack: any[]) => {
		const value = valueReader(node, objectStack);
		if (value !== undefined) {
			const object = /** @type {!Object} */ (objectStack[objectStack.length - 1]);
			const property = opt_property !== undefined ? opt_property : node.localName!;
			let array;
			if (property in object) {
				array = object[property];
			} else {
				array = object[property] = [];
			}
			array.push(value);
		}
	};
}


/**
 * Make an object property setter function.
 * @param {function(this: T, Node, Array.<*>): *} valueReader Value reader.
 * @param {string=} opt_property Property.
 * @param {T=} opt_this The object to use as `this` in `valueReader`.
 * @return {module:ol/xml~Parser} Parser.
 * @template T
 */
export function makeObjectPropertySetter(valueReader: (node: Node, objectStack: any[]) => any, opt_property?: string) {
	/**
	 * @param {Node} node Node.
	 * @param {Array.<*>} objectStack Object stack.
	 */
	return (node: Node, objectStack: any[]) => {
		const value = valueReader(node, objectStack);
		if (value !== undefined) {
			const object = /** @type {!Object} */ (objectStack[objectStack.length - 1]);
			const property = opt_property !== undefined ? opt_property : node.localName!;
			object[property] = value;
		}
	};
}


/**
 * Create a serializer that appends nodes written by its `nodeWriter` to its
 * designated parent. The parent is the `node` of the
 * {@link module:ol/xml~NodeStackItem} at the top of the `objectStack`.
 * @param {function(this: T, Node, V, Array.<*>)}
 *     nodeWriter Node writer.
 * @param {T=} opt_this The object to use as `this` in `nodeWriter`.
 * @return {module:ol/xml~Serializer} Serializer.
 * @template T, V
 */
export function makeChildAppender<V>(nodeWriter: (n: Node, v: V, d: any[]) => void) {
	return (node: Node, value: V, objectStack: any[]) => {
		nodeWriter(node, value, objectStack);
		const parent = /** @type {module:ol/xml~NodeStackItem} */ (objectStack[objectStack.length - 1]);
		const parentNode = parent.node;
		parentNode.appendChild(node);
	};
}


/**
 * Create a serializer that calls the provided `nodeWriter` from
 * {@link module:ol/xml~serialize}. This can be used by the parent writer to have the
 * 'nodeWriter' called with an array of values when the `nodeWriter` was
 * designed to serialize a single item. An example would be a LineString
 * geometry writer, which could be reused for writing MultiLineString
 * geometries.
 * @param {function(this: T, Node, V, Array.<*>)}
 *     nodeWriter Node writer.
 * @param {T=} opt_this The object to use as `this` in `nodeWriter`.
 * @return {module:ol/xml~Serializer} Serializer.
 * @template T, V
 */
export function makeArraySerializer<V>(nodeWriter: (n: Node, v: V, d: any[]) => void) {
	let nodeFactory: (_value: any, objectStack: any, opt_node_name: any) => Element;
	let serializersNS: any;
	return (node: Node, value: any[], objectStack: any[]) => {
		if (serializersNS === undefined) {
			serializersNS = {};
			const serializers = {
				[node.localName!]: nodeWriter
			};
			serializersNS[node.namespaceURI!] = serializers;
			nodeFactory = makeSimpleNodeFactory(node.localName!);
		}
		serialize(serializersNS, nodeFactory, value, objectStack);
	};
}


/**
 * Create a node factory which can use the `opt_keys` passed to
 * {@link module:ol/xml~serialize} or {@link module:ol/xml~pushSerializeAndPop} as node names,
 * or a fixed node name. The namespace of the created nodes can either be fixed,
 * or the parent namespace will be used.
 * @param {string=} opt_nodeName Fixed node name which will be used for all
 *     created nodes. If not provided, the 3rd argument to the resulting node
 *     factory needs to be provided and will be the nodeName.
 * @param {string=} opt_namespaceURI Fixed namespace URI which will be used for
 *     all created nodes. If not provided, the namespace of the parent node will
 *     be used.
 * @return {function(*, Array.<*>, string=): (Node|undefined)} Node factory.
 */
export function makeSimpleNodeFactory(opt_nodeName?: string, opt_namespaceURI?: string) {
	const fixedNodeName = opt_nodeName;
	/**
	 * @param {*} value Value.
	 * @param {Array.<*>} objectStack Object stack.
	 * @param {string=} opt_nodeName Node name.
	 * @return {Node} Node.
	 */
	return (_value: any, objectStack: any, opt_node_name: any) => {
		const context = /** @type {module:ol/xml~NodeStackItem} */ (objectStack[objectStack.length - 1]);
		const node = context.node;
		let nodeName = fixedNodeName as string;
		if (nodeName === undefined) {
			nodeName = opt_node_name;
		}

		const namespaceURI = opt_namespaceURI !== undefined ? opt_namespaceURI : node.namespaceURI;
		return createElementNS(namespaceURI, /** @type {string} */(nodeName));
	};
}


/**
 * A node factory that creates a node using the parent's `namespaceURI` and the
 * `nodeName` passed by {@link module:ol/xml~serialize} or
 * {@link module:ol/xml~pushSerializeAndPop} to the node factory.
 * @const
 * @type {function(*, Array.<*>, string=): (Node|undefined)}
 */
export const OBJECT_PROPERTY_NODE_FACTORY = makeSimpleNodeFactory();


/**
 * Create an array of `values` to be used with {@link module:ol/xml~serialize} or
 * {@link module:ol/xml~pushSerializeAndPop}, where `orderedKeys` has to be provided as
 * `opt_key` argument.
 * @param {Object.<string, V>} object Key-value pairs for the sequence. Keys can
 *     be a subset of the `orderedKeys`.
 * @param {Array.<string>} orderedKeys Keys in the order of the sequence.
 * @return {Array.<V>} Values in the order of the sequence. The resulting array
 *     has the same length as the `orderedKeys` array. Values that are not
 *     present in `object` will be `undefined` in the resulting array.
 * @template V
 */
export function makeSequence<T>(object: { [key: string]: T; }, orderedKeys: string[]) {
	const length = orderedKeys.length;
	const sequence = new Array(length);
	for (let i = 0; i < length; ++i) {
		sequence[i] = object[orderedKeys[i]];
	}
	return sequence;
}


/**
 * Create a namespaced structure, using the same values for each namespace.
 * This can be used as a starting point for versioned parsers, when only a few
 * values are version specific.
 * @param {Array.<string>} namespaceURIs Namespace URIs.
 * @param {T} structure Structure.
 * @param {Object.<string, T>=} opt_structureNS Namespaced structure to add to.
 * @return {Object.<string, T>} Namespaced structure.
 * @template T
 */
export function makeStructureNS<T>(namespaceURIs: string[], structure: T, opt_structureNS?: { [key: string]: T; }) {
	/**
	 * @type {Object.<string, T>}
	 */
	const structureNS = opt_structureNS !== undefined ? opt_structureNS : {};
	for (let i = 0, ii = namespaceURIs.length; i < ii; ++i) {
		structureNS[namespaceURIs[i]] = structure;
	}
	return structureNS;
}


/**
 * Parse a node using the parsers and object stack.
 * @param {Object.<string, Object.<string, module:ol/xml~Parser>>} parsersNS
 *     Parsers by namespace.
 * @param {Node} node Node.
 * @param {Array.<*>} objectStack Object stack.
 * @param {*=} opt_this The object to use as `this`.
 */
export function parseNode(parsersNS: { [key: string]: any; }, node: Node, objectStack: any[]) {
	for (let n = (node as Element).firstElementChild; n; n = n.nextElementSibling) {
		const parsers = parsersNS[n.namespaceURI as string];
		if (parsers !== undefined) {
			const parser = parsers[n.localName as string];
			if (parser !== undefined) {
				parser(n, objectStack);
			}
		}
	}
}


/**
 * Push an object on top of the stack, parse and return the popped object.
 * @param {T} object Object.
 * @param {Object.<string, Object.<string, module:ol/xml~Parser>>} parsersNS
 *     Parsers by namespace.
 * @param {Node} node Node.
 * @param {Array.<*>} objectStack Object stack.
 * @param {*=} opt_this The object to use as `this`.
 * @return {T} Object.
 * @template T
 */
export function pushParseAndPop<T>(object: T, parsersNS: { [key: string]: { [key: string]: void } }, node: Node, objectStack: any[]) {
	objectStack.push(object);
	parseNode(parsersNS, node, objectStack);
	return /** @type {T} */ (objectStack.pop());
}


/**
 * Walk through an array of `values` and call a serializer for each value.
 * @param {Object.<string, Object.<string, module:ol/xml~Serializer>>} serializersNS
 *     Namespaced serializers.
 * @param {function(this: T, *, Array.<*>, (string|undefined)): (Node|undefined)} nodeFactory
 *     Node factory. The `nodeFactory` creates the node whose namespace and name
 *     will be used to choose a node writer from `serializersNS`. This
 *     separation allows us to decide what kind of node to create, depending on
 *     the value we want to serialize. An example for this would be different
 *     geometry writers based on the geometry type.
 * @param {Array.<*>} values Values to serialize. An example would be an array
 *     of {@link module:ol/Feature~Feature} instances.
 * @param {Array.<*>} objectStack Node stack.
 * @param {Array.<string>=} opt_keys Keys of the `values`. Will be passed to the
 *     `nodeFactory`. This is used for serializing object literals where the
 *     node name relates to the property key. The array length of `opt_keys` has
 *     to match the length of `values`. For serializing a sequence, `opt_keys`
 *     determines the order of the sequence.
 * @param {T=} opt_this The object to use as `this` for the node factory and
 *     serializers.
 * @template T
 */
export function serialize<T>(serializersNS: { [key: string]: { [key: string]: (node: Node, value: T, objectStack: any[]) => void }; }, nodeFactory: (value: T, objectStack: any[], opt_key?: string) => Node, values: T[], objectStack: any[], opt_keys?: string[]) {
	const length = (opt_keys !== undefined ? opt_keys : values).length;
	for (let i = 0; i < length; ++i) {
		const value = values[i];
		if (value !== undefined) {
			const node = nodeFactory(value, objectStack,
				opt_keys !== undefined ? opt_keys[i] : undefined);
			if (node !== undefined) {
				serializersNS[node.namespaceURI as string][node.localName as string](node, value, objectStack);
			}
		}
	}
}


/**
 * @param {O} object Object.
 * @param {Object.<string, Object.<string, module:ol/xml~Serializer>>} serializersNS
 *     Namespaced serializers.
 * @param {function(this: T, *, Array.<*>, (string|undefined)): (Node|undefined)} nodeFactory
 *     Node factory. The `nodeFactory` creates the node whose namespace and name
 *     will be used to choose a node writer from `serializersNS`. This
 *     separation allows us to decide what kind of node to create, depending on
 *     the value we want to serialize. An example for this would be different
 *     geometry writers based on the geometry type.
 * @param {Array.<*>} values Values to serialize. An example would be an array
 *     of {@link module:ol/Feature~Feature} instances.
 * @param {Array.<*>} objectStack Node stack.
 * @param {Array.<string>=} opt_keys Keys of the `values`. Will be passed to the
 *     `nodeFactory`. This is used for serializing object literals where the
 *     node name relates to the property key. The array length of `opt_keys` has
 *     to match the length of `values`. For serializing a sequence, `opt_keys`
 *     determines the order of the sequence.
 * @param {T=} opt_this The object to use as `this` for the node factory and
 *     serializers.
 * @return {O|undefined} Object.
 * @template O, T
 */
export function pushSerializeAndPop<T>(
	object: T,
	serializersNS: {
		[key: string]: {
			[key: string]: (node: Node, value: {}, objectStack: any[]) => void;
		};
	},
	nodeFactory: (value: T, objectStack: any[], opt_key?: string | undefined) => Node,
	values: T[],
	objectStack: T[],
	opt_keys?: string[]) {
	objectStack.push(object);
	serialize(serializersNS, nodeFactory, values, objectStack, opt_keys);
	return /** @type {O|undefined} */ (objectStack.pop());
}
