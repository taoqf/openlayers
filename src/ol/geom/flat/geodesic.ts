/**
 * @module ol/geom/flat/geodesic
 */
import { Coordinate } from '../../coordinate';
import { squaredSegmentDistance, toDegrees, toRadians } from '../../math';
import { get as getProjection, getTransform, TransformFunction } from '../../proj';
import Projection from '../../proj/Projection';

/**
 * @param {function(number): module:ol/coordinate~Coordinate} interpolate Interpolate function.
 * @param {module:ol/proj~TransformFunction} transform Transform from longitude/latitude to
 *     projected coordinates.
 * @param {number} squaredTolerance Squared tolerance.
 * @return {Array.<number>} Flat coordinates.
 */
function line(interpolate: (n: number) => Coordinate, transform: TransformFunction, squaredTolerance: number) {
	// FIXME reduce garbage generation
	// FIXME optimize stack operations

	/** @type {Array.<number>} */
	const flatCoordinates = [];

	const geoA = interpolate(0);
	const geoB = interpolate(1);

	const a = transform(geoA);
	const b = transform(geoB);

	/** @type {Array.<module:ol/coordinate~Coordinate>} */
	const geoStack = [geoB, geoA];
	/** @type {Array.<module:ol/coordinate~Coordinate>} */
	const stack = [b, a];
	/** @type {Array.<number>} */
	const fractionStack = [1, 0];

	/** @type {!Object.<string, boolean>} */
	const fractions = {} as { [s: string]: boolean };

	let maxIterations = 1e5;

	while (--maxIterations > 0 && fractionStack.length > 0) {
		// Pop the a coordinate off the stack
		const frac_a = fractionStack.pop();
		const geo_a = geoStack.pop();
		const aa = stack.pop();
		// Add the a coordinate if it has not been added yet
		const key = frac_a!.toString();
		if (!(key in fractions)) {
			flatCoordinates.push(aa![0], aa![1]);
			fractions[key] = true;
		}
		// Pop the b coordinate off the stack
		const frac_b = fractionStack.pop();
		const geo_b = geoStack.pop();
		const bb = stack.pop();
		// Find the m point between the a and b coordinates
		const fracM = (frac_a! + frac_b!) / 2;
		const geoM = interpolate(fracM);
		const m = transform(geoM);
		if (squaredSegmentDistance(m[0], m[1], aa![0], aa![1],
			bb![0], bb![1]) < squaredTolerance) {
			// If the m point is sufficiently close to the straight line, then we
			// discard it.  Just use the b coordinate and move on to the next line
			// segment.
			flatCoordinates.push(bb![0], bb![1]);
			const k = frac_b!.toString();
			fractions[k] = true;
		} else {
			// Otherwise, we need to subdivide the current line segment.  Split it
			// into two and push the two line segments onto the stack.
			fractionStack.push(frac_b!, fracM, fracM, frac_a!);
			stack.push(bb!, m, m, aa!);
			geoStack.push(geo_b!, geoM, geoM, geo_a!);
		}
	}

	return flatCoordinates;
}


/**
 * Generate a great-circle arcs between two lat/lon points.
 * @param {number} lon1 Longitude 1 in degrees.
 * @param {number} lat1 Latitude 1 in degrees.
 * @param {number} lon2 Longitude 2 in degrees.
 * @param {number} lat2 Latitude 2 in degrees.
 * @param {module:ol/proj/Projection} projection Projection.
 * @param {number} squaredTolerance Squared tolerance.
 * @return {Array.<number>} Flat coordinates.
 */
export function greatCircleArc(lon1: number, lat1: number, lon2: number, lat2: number, projection: Projection, squaredTolerance: number) {
	const geoProjection = getProjection('EPSG:4326');

	const cosLat1 = Math.cos(toRadians(lat1));
	const sinLat1 = Math.sin(toRadians(lat1));
	const cosLat2 = Math.cos(toRadians(lat2));
	const sinLat2 = Math.sin(toRadians(lat2));
	const cosDeltaLon = Math.cos(toRadians(lon2 - lon1));
	const sinDeltaLon = Math.sin(toRadians(lon2 - lon1));
	const d = sinLat1 * sinLat2 + cosLat1 * cosLat2 * cosDeltaLon;

	return line(
		/**
		 * @param {number} frac Fraction.
		 * @return {module:ol/coordinate~Coordinate} Coordinate.
		 */
		(frac) => {
			if (1 <= d) {
				return [lon2, lat2];
			}
			const D = frac * Math.acos(d);
			const cosD = Math.cos(D);
			const sinD = Math.sin(D);
			const y = sinDeltaLon * cosLat2;
			const x = cosLat1 * sinLat2 - sinLat1 * cosLat2 * cosDeltaLon;
			const theta = Math.atan2(y, x);
			const lat = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(theta));
			const lon = toRadians(lon1) +
				Math.atan2(Math.sin(theta) * sinD * cosLat1,
					cosD - sinLat1 * Math.sin(lat));
			return [toDegrees(lon), toDegrees(lat)];
		}, getTransform(geoProjection!, projection), squaredTolerance);
}


/**
 * Generate a meridian (line at constant longitude).
 * @param {number} lon Longitude.
 * @param {number} lat1 Latitude 1.
 * @param {number} lat2 Latitude 2.
 * @param {module:ol/proj/Projection} projection Projection.
 * @param {number} squaredTolerance Squared tolerance.
 * @return {Array.<number>} Flat coordinates.
 */
export function meridian(lon: number, lat1: number, lat2: number, projection: Projection, squaredTolerance: number) {
	const epsg4326Projection = getProjection('EPSG:4326');
	return line(
		/**
		 * @param {number} frac Fraction.
		 * @return {module:ol/coordinate~Coordinate} Coordinate.
		 */
		(frac) => {
			return [lon, lat1 + ((lat2 - lat1) * frac)];
		},
		getTransform(epsg4326Projection!, projection), squaredTolerance);
}


/**
 * Generate a parallel (line at constant latitude).
 * @param {number} lat Latitude.
 * @param {number} lon1 Longitude 1.
 * @param {number} lon2 Longitude 2.
 * @param {module:ol/proj/Projection} projection Projection.
 * @param {number} squaredTolerance Squared tolerance.
 * @return {Array.<number>} Flat coordinates.
 */
export function parallel(lat: number, lon1: number, lon2: number, projection: Projection, squaredTolerance: number) {
	const epsg4326Projection = getProjection('EPSG:4326');
	return line(
		/**
		 * @param {number} frac Fraction.
		 * @return {module:ol/coordinate~Coordinate} Coordinate.
		 */
		(frac) => {
			return [lon1 + ((lon2 - lon1) * frac), lat];
		},
		getTransform(epsg4326Projection!, projection), squaredTolerance);
}
