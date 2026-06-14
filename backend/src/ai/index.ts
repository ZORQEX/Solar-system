/** Public surface of the AI module. */
export {
  NeuralNetwork,
  tanh,
  sigmoid,
  relu,
  type Activation,
  type SerializedNet,
} from "./neural-network.ts";
export {
  advanceLife,
  evolveBiosphere,
  evolveCivilization,
  type LifeWorld,
  type CivEnvironment,
} from "./evolution.ts";
