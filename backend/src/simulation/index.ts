/** Public surface of the simulation module. */
export {
  TimeController,
  TIME_SCALES,
  type TimeScaleName,
} from "./time.ts";
export {
  World,
  type WorldSave,
  type StarSave,
} from "./world.ts";
export {
  Simulation,
  type SimulationOptions,
  type AdvanceReport,
} from "./simulation.ts";
