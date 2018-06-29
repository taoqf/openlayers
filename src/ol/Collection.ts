/**
 * @module ol/Collection
 */
import AssertionError from './AssertionError';
import CollectionEventType from './CollectionEventType';
import Event from './events/Event';
import BaseObject from './Object';


/**
 * @enum {string}
 * @private
 */
enum Property {
	LENGTH = 'length'
}


/**
 * @classdesc
 * Events emitted by {@link module:ol/Collection~Collection} instances are instances of this
 * type.
 *
 * @constructor
 * @extends {module:ol/events/Event}
 * @param {module:ol/CollectionEventType} type Type.
 * @param {*=} opt_element Element.
 */
export class CollectionEvent extends Event {
	public element: any;
	constructor(type: CollectionEventType, opt_element?: any) {

		super(type);

		/**
		 * The element that is added to or removed from the collection.
		 * @type {*}
		 * @api
		 */
		this.element = opt_element;
	}
}


/**
 * @typedef {Object} Options
 * @property {boolean} [unique=false] Disallow the same item from being added to
 * the collection twice.
 */

export interface Options {
	unique: boolean;
}

/**
 * @classdesc
 * An expanded version of standard JS Array, adding convenience methods for
 * manipulation. Add and remove changes to the Collection trigger a Collection
 * event. Note that this does not cover changes to the objects _within_ the
 * Collection; they trigger events on the appropriate object, not on the
 * Collection as a whole.
 *
 * @constructor
 * @extends {module:ol/Object}
 * @fires module:ol/Collection~CollectionEvent
 * @param {Array.<T>=} opt_array Array.
 * @param {module:ol/Collection~Options=} opt_options Collection options.
 * @template T
 * @api
 */
export default class Collection<T> extends BaseObject {
	private unique_: boolean;
	private array_: T[];
	constructor(opt_array?: T[], opt_options?: Partial<Options>) {
		super();

		const options = opt_options || {};

		/**
		 * @private
		 * @type {boolean}
		 */
		this.unique_ = !!options.unique;

		/**
		 * @private
		 * @type {!Array.<T>}
		 */
		this.array_ = opt_array ? opt_array : [];

		if (this.unique_) {
			for (let i = 0, ii = this.array_.length; i < ii; ++i) {
				this.assertUnique_(this.array_[i], i);
			}
		}

		this.updateLength_();
	}

	/**
	 * Remove all elements from the collection.
	 * @api
	 */
	public clear() {
		while (this.getLength() > 0) {
			this.pop();
		}
	}


	/**
	 * Add elements to the collection.  This pushes each item in the provided array
	 * to the end of the collection.
	 * @param {!Array.<T>} arr Array.
	 * @return {module:ol/Collection.<T>} This collection.
	 * @api
	 */
	public extend(arr: T[]) {
		for (let i = 0, ii = arr.length; i < ii; ++i) {
			this.push(arr[i]);
		}
		return this;
	}


	/**
	 * Iterate over each element, calling the provided callback.
	 * @param {function(T, number, Array.<T>): *} f The function to call
	 *     for every element. This function takes 3 arguments (the element, the
	 *     index and the array). The return value is ignored.
	 * @api
	 */
	public forEach(f: (v: T, i: number, arr: T[]) => void) {
		const array = this.array_;
		for (let i = 0, ii = array.length; i < ii; ++i) {
			f(array[i], i, array);
		}
	}


	/**
	 * Get a reference to the underlying Array object. Warning: if the array
	 * is mutated, no events will be dispatched by the collection, and the
	 * collection's "length" property won't be in sync with the actual length
	 * of the array.
	 * @return {!Array.<T>} Array.
	 * @api
	 */
	public getArray() {
		return this.array_;
	}


	/**
	 * Get the element at the provided index.
	 * @param {number} index Index.
	 * @return {T} Element.
	 * @api
	 */
	public item(index: number) {
		return this.array_[index];
	}


	/**
	 * Get the length of this collection.
	 * @return {number} The length of the array.
	 * @observable
	 * @api
	 */
	public getLength() {
		return /** @type {number} */ (this.get(Property.LENGTH));
	}


	/**
	 * Insert an element at the provided index.
	 * @param {number} index Index.
	 * @param {T} elem Element.
	 * @api
	 */
	public insertAt(index: number, elem: T) {
		if (this.unique_) {
			this.assertUnique_(elem);
		}
		this.array_.splice(index, 0, elem);
		this.updateLength_();
		this.dispatchEvent(
			new CollectionEvent(CollectionEventType.ADD, elem));
	}


	/**
	 * Remove the last element of the collection and return it.
	 * Return `undefined` if the collection is empty.
	 * @return {T|undefined} Element.
	 * @api
	 */
	public pop() {
		return this.removeAt(this.getLength() - 1);
	}


	/**
	 * Insert the provided element at the end of the collection.
	 * @param {T} elem Element.
	 * @return {number} New length of the collection.
	 * @api
	 */
	public push(elem: T) {
		if (this.unique_) {
			this.assertUnique_(elem);
		}
		const n = this.getLength();
		this.insertAt(n, elem);
		return this.getLength();
	}


	/**
	 * Remove the first occurrence of an element from the collection.
	 * @param {T} elem Element.
	 * @return {T|undefined} The removed element or undefined if none found.
	 * @api
	 */
	public remove(elem: T) {
		const arr = this.array_;
		for (let i = 0, ii = arr.length; i < ii; ++i) {
			if (arr[i] === elem) {
				return this.removeAt(i);
			}
		}
		return undefined;
	}


	/**
	 * Remove the element at the provided index and return it.
	 * Return `undefined` if the collection does not contain this index.
	 * @param {number} index Index.
	 * @return {T|undefined} Value.
	 * @api
	 */
	public removeAt(index: number) {
		const prev = this.array_[index];
		this.array_.splice(index, 1);
		this.updateLength_();
		this.dispatchEvent(new CollectionEvent(CollectionEventType.REMOVE, prev));
		return prev;
	}


	/**
	 * Set the element at the provided index.
	 * @param {number} index Index.
	 * @param {T} elem Element.
	 * @api
	 */
	public setAt(index: number, elem: T) {
		const n = this.getLength();
		if (index < n) {
			if (this.unique_) {
				this.assertUnique_(elem, index);
			}
			const prev = this.array_[index];
			this.array_[index] = elem;
			this.dispatchEvent(
				new CollectionEvent(CollectionEventType.REMOVE, prev));
			this.dispatchEvent(
				new CollectionEvent(CollectionEventType.ADD, elem));
		} else {
			for (let j = n; j < index; ++j) {
				this.insertAt(j, undefined!);
			}
			this.insertAt(index, elem);
		}
	}


	/**
	 * @private
	 */
	private updateLength_() {
		this.set(Property.LENGTH, this.array_.length);
	}


	/**
	 * @private
	 * @param {T} elem Element.
	 * @param {number=} opt_except Optional index to ignore.
	 */
	private assertUnique_(elem: T, opt_except?: number) {
		for (let i = 0, ii = this.array_.length; i < ii; ++i) {
			if (this.array_[i] === elem && i !== opt_except) {
				throw new AssertionError(58);
			}
		}
	}
}
