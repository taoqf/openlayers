/**
 * @module ol/source/WMSServerType
 */

/**
 * Available server types: `'carmentaserver'`, `'geoserver'`, `'mapserver'`,
 *     `'qgis'`. These are servers that have vendor parameters beyond the WMS
 *     specification that OpenLayers can make use of.
 * @enum {string}
 */
enum WMSServerType {
	CARMENTA_SERVER = 'carmentaserver',
	GEOSERVER = 'geoserver',
	MAPSERVER = 'mapserver',
	QGIS = 'qgis'
}

export default WMSServerType;
