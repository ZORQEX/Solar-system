import { Rng } from "../entities/random.ts";

/** Scalar activation function. */
export type Activation = (x: number) => number;

export const tanh: Activation = Math.tanh;
export const sigmoid: Activation = (x) => 1 / (1 + Math.exp(-x));
export const relu: Activation = (x) => (x > 0 ? x : 0);

interface Layer {
  /** weights[out][in] */
  weights: number[][];
  biases: number[];
}

export interface SerializedNet {
  layerSizes: number[];
  layers: Layer[];
}

/**
 * A small fully-connected feed-forward network — enough to give an entity a
 * cheap, reactive "brain" (e.g. a civilization deciding whether to expand).
 * Deterministic: built from an {@link Rng}, so the same seed yields the same
 * weights and therefore the same behaviour.
 */
export class NeuralNetwork {
  readonly layerSizes: number[];
  private readonly layers: Layer[];
  private readonly activation: Activation;

  constructor(layerSizes: number[], layers: Layer[], activation: Activation = tanh) {
    this.layerSizes = layerSizes;
    this.layers = layers;
    this.activation = activation;
  }

  /** Random network with Xavier-ish init (weights ~ N(0, 1/√fanIn)). */
  static random(
    layerSizes: number[],
    rng: Rng,
    activation: Activation = tanh,
  ): NeuralNetwork {
    if (layerSizes.length < 2) {
      throw new Error("NeuralNetwork needs at least input and output sizes");
    }
    const layers: Layer[] = [];
    for (let l = 1; l < layerSizes.length; l++) {
      const fanIn = layerSizes[l - 1]!;
      const fanOut = layerSizes[l]!;
      const scale = 1 / Math.sqrt(fanIn);
      const weights: number[][] = [];
      const biases: number[] = [];
      for (let o = 0; o < fanOut; o++) {
        const row: number[] = [];
        for (let i = 0; i < fanIn; i++) row.push(rng.gaussian(0, scale));
        weights.push(row);
        biases.push(rng.gaussian(0, scale));
      }
      layers.push({ weights, biases });
    }
    return new NeuralNetwork(layerSizes, layers, activation);
  }

  /** Run the network forward. Throws on a mismatched input length. */
  forward(input: number[]): number[] {
    if (input.length !== this.layerSizes[0]) {
      throw new Error(
        `expected ${this.layerSizes[0]} inputs, got ${input.length}`,
      );
    }
    let activations = input;
    for (const layer of this.layers) {
      const next: number[] = new Array(layer.biases.length);
      for (let o = 0; o < layer.weights.length; o++) {
        const row = layer.weights[o]!;
        let sum = layer.biases[o]!;
        for (let i = 0; i < row.length; i++) sum += row[i]! * activations[i]!;
        next[o] = this.activation(sum);
      }
      activations = next;
    }
    return activations;
  }

  /** A mutated copy: each weight/bias nudged by N(0, scale) with probability `rate`. */
  mutate(rng: Rng, rate = 0.1, scale = 0.2): NeuralNetwork {
    const layers = this.layers.map((layer) => ({
      weights: layer.weights.map((row) =>
        row.map((w) => (rng.next() < rate ? w + rng.gaussian(0, scale) : w)),
      ),
      biases: layer.biases.map((b) =>
        rng.next() < rate ? b + rng.gaussian(0, scale) : b,
      ),
    }));
    return new NeuralNetwork([...this.layerSizes], layers, this.activation);
  }

  toJSON(): SerializedNet {
    return {
      layerSizes: [...this.layerSizes],
      layers: this.layers.map((l) => ({
        weights: l.weights.map((r) => [...r]),
        biases: [...l.biases],
      })),
    };
  }

  static fromJSON(data: SerializedNet, activation: Activation = tanh): NeuralNetwork {
    return new NeuralNetwork(data.layerSizes, data.layers, activation);
  }
}
