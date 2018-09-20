/**
 * @module ol/net
 */
import { getUid } from './index';


/**
 * Simple JSONP helper. Supports error callbacks and a custom callback param.
 * The error callback will be called when no JSONP is executed after 10 seconds.
 *
 * @param {string} url Request url. A 'callback' query parameter will be
 *     appended.
 * @param {Function} callback Callback on success.
 * @param {function()=} opt_errback Callback on error.
 * @param {string=} opt_callbackParam Custom query parameter for the JSONP
 *     callback. Default is 'callback'.
 */
export function jsonp(url: string, callback: (data: any) => void, opt_errback?: () => void, opt_callbackParam?: string) {
	const script = document.createElement('script');
	const key = 'olc_' + getUid(callback as any);
	function cleanup() {
		delete (window as any)[key];
		script.parentNode.removeChild(script);
	}
	script.async = true;
	script.src = url + (url.indexOf('?') === -1 ? '?' : '&') +
		(opt_callbackParam || 'callback') + '=' + key;
	const timer = setTimeout(() => {
		cleanup();
		if (opt_errback) {
			opt_errback();
		}
	}, 10000);
	(window as any)[key] = (data: any) => {
		clearTimeout(timer);
		cleanup();
		callback(data);
	};
	document.getElementsByTagName('head')[0].appendChild(script);
}