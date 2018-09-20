/**
 * @module ol/structs/LRUCache
 */
import { assert } from '../asserts';
import EventTarget from '../events/EventTarget';
import EventType from '../events/EventType';


/**
 * @typedef {Object} Entry
 * @property {string} key_
 * @property {Object} newer
 * @property {Object} older
 * @property {*} value_
 */

export interface Entry<T> {
	key_: string;
	newer: Entry<T> | null;
	older: Entry<T> | null;
	value_: T;
}

/**
 * Implements a Least-Recently-Used cache where the keys do not conflict with
 * Object's properties (e.g. 'hasOwnProperty' is not allowed as a key). Expiring
 * items from the cache is the responsibility of the user.
 * @constructor
 * @extends {module:ol/events/EventTarget}
 * @fires module:ol/events/Event~Event
 * @struct
 * @template T
 * @param {number=} opt_highWaterMark High water mark.
 */
export default class LRUCache<T> extends EventTarget {
	public highWaterMark: number;
	private count: number;
	private entries: { [k: string]: Entry<T>; };
	private oldest: Entry<T> | null;
	private newest: Entry<T> | null;
	constructor(opt_highWaterMark?: number) {

		super();

		/**
		 * @type {number}
		 */
		this.highWaterMark = opt_highWaterMark !== undefined ? opt_highWaterMark : 2048;

		/**
		 * @private
		 * @type {number}
		 */
		this.count = 0;

		/**
		 * @private
		 * @type {!Object.<string, module:ol/structs/LRUCache~Entry>}
		 */
		this.entries = {};

		/**
		 * @private
		 * @type {?module:ol/structs/LRUCache~Entry}
		 */
		this.oldest = null;

		/**
		 * @private
		 * @type {?module:ol/structs/LRUCache~Entry}
		 */
		this.newest = null;

	}

	/**
	 * @return {boolean} Can expire cache.
	 */
	public canExpireCache() {
		return this.getCount() > this.highWaterMark;
	}


	/**
	 * FIXME empty description for jsdoc
	 */
	public clear() {
		this.count = 0;
		this.entries = {};
		this.oldest = null;
		this.newest = null;
		this.dispatchEvent(EventType.CLEAR);
	}


	/**
	 * @param {string} key Key.
	 * @return {boolean} Contains key.
	 */
	public containsKey(key: string) {
		return this.entries.hasOwnProperty(key);
	}


	/**
	 * @param {function(this: S, T, string, module:ol/structs/LRUCache): ?} f The function
	 *     to call for every entry from the oldest to the newer. This function takes
	 *     3 arguments (the entry value, the entry key and the LRUCache object).
	 *     The return value is ignored.
	 * @param {S=} opt_this The object to use as `this` in `f`.
	 * @template S
	 */
	public forEach<S>(f: (this: S, value: T, key: string, cache: LRUCache<T>) => void, opt_this?: S) {
		let entry = this.oldest;
		while (entry) {
			f.call(opt_this, entry.value_, entry.key_, this);
			entry = entry.newer;
		}
	}


	/**
	 * @param {string} key Key.
	 * @return {T} Value.
	 */
	public get(key: string) {
		const entry = this.entries[key];
		assert(entry !== undefined,
			15); // Tried to get a value for a key that does not exist in the cache
		if (entry === this.newest) {
			return entry.value_;
		} else if (entry === this.oldest) {
			this.oldest = /** @type {module:ol/structs/LRUCache~Entry} */ (this.oldest.newer);
			this.oldest!.older = null;
		} else {
			entry.newer!.older = entry.older;
			entry.older!.newer = entry.newer;
		}
		entry.newer = null;
		entry.older = this.newest;
		this.newest!.newer = entry;
		this.newest = entry;
		return entry.value_;
	}


	/**
	 * Remove an entry from the cache.
	 * @param {string} key The entry key.
	 * @return {T} The removed entry.
	 */
	public remove(key: string) {
		const entry = this.entries[key];
		assert(entry !== undefined, 15); // Tried to get a value for a key that does not exist in the cache
		if (entry === this.newest) {
			this.newest = /** @type {module:ol/structs/LRUCache~Entry} */ (entry.older);
			if (this.newest) {
				this.newest.newer = null;
			}
		} else if (entry === this.oldest) {
			this.oldest = /** @type {module:ol/structs/LRUCache~Entry} */ (entry.newer);
			if (this.oldest) {
				this.oldest.older = null;
			}
		} else {
			entry.newer!.older = entry.older;
			entry.older!.newer = entry.newer;
		}
		delete this.entries[key];
		--this.count;
		return entry.value_ as T;
	}


	/**
	 * @return {number} Count.
	 */
	public getCount() {
		return this.count;
	}


	/**
	 * @return {Array.<string>} Keys.
	 */
	public getKeys() {
		const keys = new Array(this.count);
		let i = 0;
		let entry;
		for (entry = this.newest; entry; entry = entry.older) {
			keys[i++] = entry.key_;
		}
		return keys;
	}


	/**
	 * @return {Array.<T>} Values.
	 */
	public getValues() {
		const values = new Array(this.count);
		let i = 0;
		let entry;
		for (entry = this.newest; entry; entry = entry.older) {
			values[i++] = entry.value_;
		}
		return values;
	}


	/**
	 * @return {T} Last value.
	 */
	public peekLast() {
		return this.oldest!.value_;
	}


	/**
	 * @return {string} Last key.
	 */
	public peekLastKey() {
		return this.oldest!.key_;
	}


	/**
	 * Get the key of the newest item in the cache.  Throws if the cache is empty.
	 * @return {string} The newest key.
	 */
	public peekFirstKey() {
		return this.newest!.key_;
	}


	/**
	 * @return {T} value Value.
	 */
	public pop() {
		const entry = this.oldest!;
		delete this.entries[entry.key_];
		if (entry.newer) {
			entry.newer.older = null;
		}
		this.oldest = /** @type {module:ol/structs/LRUCache~Entry} */ (entry.newer);
		if (!this.oldest) {
			this.newest = null;
		}
		--this.count;
		return entry.value_;
	}


	/**
	 * @param {string} key Key.
	 * @param {T} value Value.
	 */
	public replace(key: string, value: T) {
		this.get(key);  // update `newest_`
		this.entries[key].value_ = value;
	}


	/**
	 * @param {string} key Key.
	 * @param {T} value Value.
	 */
	public set(key: string, value: T) {
		assert(!(key in this.entries),
			16); // Tried to set a value for a key that is used already
		const entry = /** @type {module:ol/structs/LRUCache~Entry} */ ({
			key_: key,
			newer: null,
			older: this.newest,
			value_: value
		}) as Entry<T>;
		if (!this.newest) {
			this.oldest = entry;
		} else {
			this.newest.newer = entry;
		}
		this.newest = entry;
		this.entries[key] = entry;
		++this.count;
	}

	/**
	 * Set a maximum number of entries for the cache.
	 * @param {number} size Cache size.
	 * @api
	 */
	public setSize(size: number) {
		this.highWaterMark = size;
	}


	/**
	 * Prune the cache.
	 */
	public prune() {
		while (this.canExpireCache()) {
			this.pop();
		}
	}
}
