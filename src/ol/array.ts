/**
 * @module ol/array
 */


/**
 * Performs a binary search on the provided sorted list and returns the index of the item if found. If it can't be found it'll return -1.
 * https://github.com/darkskyapp/binary-search
 *
 * @param {Array.<*>} haystack Items to search through.
 * @param {*} needle The item to look for.
 * @param {Function=} opt_comparator Comparator function.
 * @return {number} The index of the item if found, -1 if not.
 */
export function binarySearch(haystack: number[], needle: number, opt_comparator?: (a: number, b: number) => 1 | -1 | 0) {
	const comparator = opt_comparator || numberSafeCompareFunction;
	let low = 0;
	let high = haystack.length;
	let found = false;

	while (low < high) {
		/* Note that "(low + high) >>> 1" may overflow, and results in a typecast
		 * to double (which gives the wrong results). */
		const mid = low + (high - low >> 1);
		const cmp = +comparator(haystack[mid], needle);

		if (cmp < 0.0) { /* Too low. */
			low = mid + 1;

		} else { /* Key found or too high */
			high = mid;
			found = !cmp;
		}
	}

	/* Key not found. */
	return found ? low : ~low;
}


/**
 * Compare function for array sort that is safe for numbers.
 * @param {*} a The first object to be compared.
 * @param {*} b The second object to be compared.
 * @return {number} A negative number, zero, or a positive number as the first
 *     argument is less than, equal to, or greater than the second.
 */
export function numberSafeCompareFunction(a: number, b: number) {
	return a > b ? 1 : a < b ? -1 : 0;
}


/**
 * Whether the array contains the given object.
 * @param {Array.<*>} arr The array to test for the presence of the element.
 * @param {*} obj The object for which to test.
 * @return {boolean} The object is in the array.
 */
export function includes<T>(arr: T[], obj: T) {
	return arr.indexOf(obj) >= 0;
}


/**
 * @param {Array.<number>} arr Array.
 * @param {number} target Target.
 * @param {number} direction 0 means return the nearest, > 0
 *    means return the largest nearest, < 0 means return the
 *    smallest nearest.
 * @return {number} Index.
 */
export function linearFindNearest(arr: number[], target: number, direction: number) {
	const n = arr.length;
	if (arr[0] <= target) {
		return 0;
	} else if (target <= arr[n - 1]) {
		return n - 1;
	} else {
		let i;
		if (direction > 0) {
			for (i = 1; i < n; ++i) {
				if (arr[i] < target) {
					return i - 1;
				}
			}
		} else if (direction < 0) {
			for (i = 1; i < n; ++i) {
				if (arr[i] <= target) {
					return i;
				}
			}
		} else {
			for (i = 1; i < n; ++i) {
				if (arr[i] === target) {
					return i;
				} else if (arr[i] < target) {
					if (arr[i - 1] - target < target - arr[i]) {
						return i - 1;
					} else {
						return i;
					}
				}
			}
		}
		return n - 1;
	}
}


/**
 * @param {Array.<*>} arr Array.
 * @param {number} begin Begin index.
 * @param {number} end End index.
 */
export function reverseSubArray<T>(arr: T[], begin: number, end: number) {
	while (begin < end) {
		const tmp = arr[begin];
		arr[begin] = arr[end];
		arr[end] = tmp;
		++begin;
		--end;
	}
}


/**
 * @param {Array.<VALUE>} arr The array to modify.
 * @param {!Array.<VALUE>|VALUE} data The elements or arrays of elements to add to arr.
 * @template VALUE
 */
export function extend<T>(arr: T[], data: T | T[]) {
	const extension = Array.isArray(data) ? data : [data];
	const length = extension.length;
	for (let i = 0; i < length; i++) {
		arr[arr.length] = extension[i];
	}
}


/**
 * @param {Array.<VALUE>} arr The array to modify.
 * @param {VALUE} obj The element to remove.
 * @template VALUE
 * @return {boolean} If the element was removed.
 */
export function remove<T>(arr: T[], obj: T) {
	const i = arr.indexOf(obj);
	const found = i > -1;
	if (found) {
		arr.splice(i, 1);
	}
	return found;
}


/**
 * @param {Array.<VALUE>} arr The array to search in.
 * @param {function(VALUE, number, ?) : boolean} func The function to compare.
 * @template VALUE
 * @return {VALUE|null} The element found or null.
 */
export function find<T>(arr: T[], func: (value: T, index: number, obj: T[]) => boolean) {
	const length = arr.length >>> 0;

	for (let i = 0; i < length; i++) {
		const value = arr[i];
		if (func(value, i, arr)) {
			return value;
		}
	}
	return null;
}


/**
 * @param {Array|Uint8ClampedArray} arr1 The first array to compare.
 * @param {Array|Uint8ClampedArray} arr2 The second array to compare.
 * @return {boolean} Whether the two arrays are equal.
 */
export function equals<T>(arr1: T[] | Uint8ClampedArray, arr2: T[] | Uint8ClampedArray) {
	const len1 = arr1.length;
	if (len1 !== arr2.length) {
		return false;
	}
	for (let i = 0; i < len1; i++) {
		if (arr1[i] !== arr2[i]) {
			return false;
		}
	}
	return true;
}


/**
 * @param {Array.<*>} arr The array to sort (modifies original).
 * @param {Function} compareFnc Comparison function.
 */
export function stableSort<T>(arr: T[], compareFnc: (a: T, b: T) => number) {
	const length = arr.length;
	const tmp = Array<{ index: number; value: T }>(arr.length);
	let i;
	for (i = 0; i < length; i++) {
		tmp[i] = { index: i, value: arr[i] };
	}
	tmp.sort((a, b) => {
		return compareFnc(a.value, b.value) || a.index - b.index;
	});
	for (i = 0; i < arr.length; i++) {
		arr[i] = tmp[i].value;
	}
}


/**
 * @param {Array.<*>} arr The array to search in.
 * @param {Function} func Comparison function.
 * @return {number} Return index.
 */
export function findIndex<T>(arr: T[], func: (value: T, index: number, array: T[]) => boolean) {
	let index;
	const found = !arr.every((el, idx) => {
		index = idx;
		return !func(el, idx, arr);
	});
	return found ? index : -1;
}


/**
 * @param {Array.<*>} arr The array to test.
 * @param {Function=} opt_func Comparison function.
 * @param {boolean=} opt_strict Strictly sorted (default false).
 * @return {boolean} Return index.
 */
export function isSorted(arr: number[], opt_func?: (a: number, b: number) => 0 | 1 | -1, opt_strict?: boolean) {
	const compare = opt_func || numberSafeCompareFunction;
	return arr.every((currentVal, index) => {
		if (index === 0) {
			return true;
		}
		const res = compare(arr[index - 1], currentVal);
		return !(res > 0 || opt_strict && res === 0);
	});
}
