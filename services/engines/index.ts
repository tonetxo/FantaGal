/**
 * Engine registrations
 * Import this file to register all engines with the EngineRegistry.
 */

// Import each engine's registration file to trigger registration
import './criosfera.register';
import './gearheart.register';
import './echoVessel.register';

// Re-export vial labels for Echo Vessel (specific to that engine's UI)
export { ECHO_VESSEL_VIAL_LABELS } from './echoVessel.register';
