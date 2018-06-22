/**
 * @module ol/interaction
 */
import Collection from './Collection';
import Kinetic from './Kinetic';
import DoubleClickZoom from './interaction/DoubleClickZoom';
import DragPan from './interaction/DragPan';
import DragRotate from './interaction/DragRotate';
import DragZoom from './interaction/DragZoom';
import KeyboardPan from './interaction/KeyboardPan';
import KeyboardZoom from './interaction/KeyboardZoom';
import MouseWheelZoom from './interaction/MouseWheelZoom';
import PinchRotate from './interaction/PinchRotate';
import PinchZoom from './interaction/PinchZoom';

export {default as DoubleClickZoom} from './interaction/DoubleClickZoom';
export {default as DragAndDrop} from './interaction/DragAndDrop';
export {default as DragBox} from './interaction/DragBox';
export {default as DragPan} from './interaction/DragPan';
export {default as DragRotate} from './interaction/DragRotate';
export {default as DragRotateAndZoom} from './interaction/DragRotateAndZoom';
export {default as DragZoom} from './interaction/DragZoom';
export {default as Draw} from './interaction/Draw';
export {default as Extent} from './interaction/Extent';
export {default as Interaction} from './interaction/Interaction';
export {default as KeyboardPan} from './interaction/KeyboardPan';
export {default as KeyboardZoom} from './interaction/KeyboardZoom';
export {default as Modify} from './interaction/Modify';
export {default as MouseWheelZoom} from './interaction/MouseWheelZoom';
export {default as PinchRotate} from './interaction/PinchRotate';
export {default as PinchZoom} from './interaction/PinchZoom';
export {default as Pointer} from './interaction/Pointer';
export {default as Select} from './interaction/Select';
export {default as Snap} from './interaction/Snap';
export {default as Translate} from './interaction/Translate';


/**
 * @typedef {Object} DefaultsOptions
 * @property {boolean} [altShiftDragRotate=true] Whether Alt-Shift-drag rotate is
 * desired.
 * @property {boolean} [constrainResolution=false] Zoom to the closest integer
 * zoom level after the wheel/trackpad or pinch gesture ends.
 * @property {boolean} [doubleClickZoom=true] Whether double click zoom is
 * desired.
 * @property {boolean} [keyboard=true] Whether keyboard interaction is desired.
 * @property {boolean} [mouseWheelZoom=true] Whether mousewheel zoom is desired.
 * @property {boolean} [shiftDragZoom=true] Whether Shift-drag zoom is desired.
 * @property {boolean} [dragPan=true] Whether drag pan is desired.
 * @property {boolean} [pinchRotate=true] Whether pinch rotate is desired.
 * @property {boolean} [pinchZoom=true] Whether pinch zoom is desired.
 * @property {number} [zoomDelta] Zoom level delta when using keyboard or
 * mousewheel zoom.
 * @property {number} [zoomDuration] Duration of the zoom animation in
 * milliseconds.
 */


/**
 * Set of interactions included in maps by default. Specific interactions can be
 * excluded by setting the appropriate option to false in the constructor
 * options, but the order of the interactions is fixed.  If you want to specify
 * a different order for interactions, you will need to create your own
 * {@link module:ol/interaction/Interaction} instances and insert
 * them into a {@link module:ol/Collection} in the order you want
 * before creating your {@link module:ol/Map~Map} instance. The default set of
 * interactions, in sequence, is:
 * * {@link module:ol/interaction/DragRotate~DragRotate}
 * * {@link module:ol/interaction/DoubleClickZoom~DoubleClickZoom}
 * * {@link module:ol/interaction/DragPan~DragPan}
 * * {@link module:ol/interaction/PinchRotate~PinchRotate}
 * * {@link module:ol/interaction/PinchZoom~PinchZoom}
 * * {@link module:ol/interaction/KeyboardPan~KeyboardPan}
 * * {@link module:ol/interaction/KeyboardZoom~KeyboardZoom}
 * * {@link module:ol/interaction/MouseWheelZoom~MouseWheelZoom}
 * * {@link module:ol/interaction/DragZoom~DragZoom}
 *
 * @param {module:ol/interaction/Interaction~DefaultsOptions=} opt_options
 * Defaults options.
 * @return {module:ol/Collection.<module:ol/interaction/Interaction>}
 * A collection of interactions to be used with the {@link module:ol/Map~Map}
 * constructor's `interactions` option.
 * @api
 */
export function defaults(opt_options) {

  const options = opt_options ? opt_options : {};

  const interactions = new Collection();

  const kinetic = new Kinetic(-0.005, 0.05, 100);

  const altShiftDragRotate = options.altShiftDragRotate !== undefined ?
    options.altShiftDragRotate : true;
  if (altShiftDragRotate) {
    interactions.push(new DragRotate());
  }

  const doubleClickZoom = options.doubleClickZoom !== undefined ?
    options.doubleClickZoom : true;
  if (doubleClickZoom) {
    interactions.push(new DoubleClickZoom({
      delta: options.zoomDelta,
      duration: options.zoomDuration
    }));
  }

  const dragPan = options.dragPan !== undefined ? options.dragPan : true;
  if (dragPan) {
    interactions.push(new DragPan({
      kinetic: kinetic
    }));
  }

  const pinchRotate = options.pinchRotate !== undefined ? options.pinchRotate :
    true;
  if (pinchRotate) {
    interactions.push(new PinchRotate());
  }

  const pinchZoom = options.pinchZoom !== undefined ? options.pinchZoom : true;
  if (pinchZoom) {
    interactions.push(new PinchZoom({
      constrainResolution: options.constrainResolution,
      duration: options.zoomDuration
    }));
  }

  const keyboard = options.keyboard !== undefined ? options.keyboard : true;
  if (keyboard) {
    interactions.push(new KeyboardPan());
    interactions.push(new KeyboardZoom({
      delta: options.zoomDelta,
      duration: options.zoomDuration
    }));
  }

  const mouseWheelZoom = options.mouseWheelZoom !== undefined ?
    options.mouseWheelZoom : true;
  if (mouseWheelZoom) {
    interactions.push(new MouseWheelZoom({
      constrainResolution: options.constrainResolution,
      duration: options.zoomDuration
    }));
  }

  const shiftDragZoom = options.shiftDragZoom !== undefined ?
    options.shiftDragZoom : true;
  if (shiftDragZoom) {
    interactions.push(new DragZoom({
      duration: options.zoomDuration
    }));
  }

  return interactions;

}
