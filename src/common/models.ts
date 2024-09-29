import { InferenceSession, Tensor } from "onnxruntime-web";

import { log } from "./logging";

export type ONNXRuntimeAPI = typeof import("onnxruntime-web");

export type ModelFetcher = () => Promise<ArrayBuffer>;

export type OrtOptions = {
  ortConfig?: (ort: ONNXRuntimeAPI) => any;
};

export type SpeechProbabilities = {
  notSpeech: number;
  isSpeech: number;
};

export type Model = {
  reset_state: () => void;
  process: (arr: Float32Array) => Promise<SpeechProbabilities>;
};

export class ONNXModel {
  _session!: InferenceSession;
  _h!: Tensor;
  _c!: Tensor;
  _sr!: Tensor;

  constructor(
    private ort: ONNXRuntimeAPI,
    private modelFetcher: ModelFetcher,
  ) {}

  static new = async (ort: ONNXRuntimeAPI, modelFetcher: ModelFetcher) => {
    const model = new ONNXModel(ort, modelFetcher);
    await model.init();
    return model;
  };

  init = async () => {
    log.debug("initializing detection");
    const modelArrayBuffer = await this.modelFetcher();
    this._session = await this.ort.InferenceSession.create(modelArrayBuffer);
    this._sr = new this.ort.Tensor("int64", [16000n]);
    this.reset_state();
    log.debug("detection is initialized");
  };

  reset_state = () => {
    const zeroes = Array(2 * 64).fill(0);
    this._h = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
    this._c = new this.ort.Tensor("float32", zeroes, [2, 1, 64]);
  };

  process = async (audioFrame: Float32Array): Promise<SpeechProbabilities> => {
    const t = new this.ort.Tensor("float32", audioFrame, [1, audioFrame.length]);
    const inputs = {
      input: t,
      h: this._h,
      c: this._c,
      sr: this._sr,
    };
    const out = await this._session.run(inputs);
    this._h = out.hn;
    this._c = out.cn;
    const isSpeech = out.output.data[0] as number;
    const notSpeech = 1 - isSpeech;
    return { notSpeech, isSpeech };
  };
}
