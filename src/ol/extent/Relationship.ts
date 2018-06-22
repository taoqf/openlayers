/**
 * @module ol/extent/Relationship
 */

/**
 * Relationship to an extent.
 * @enum {number}
 */
enum Relationship {
	ABOVE = 2,
	BELOW = 8,
	INTERSECTING = 1,
	LEFT = 16,
	RIGHT = 4,
	UNKNOWN = 0
}

export default Relationship;
