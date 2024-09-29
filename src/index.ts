import * as ort from "onnxruntime-web";

import { assetPath } from "./asset-path";
import {
  utils as _utils,
  FrameProcessor,
  FrameProcessorOptions,
  Message,
  NonRealTimeDetectionOptions,
  PlatformAgnosticNonRealTimeDetection,
} from "./common";
import { defaultModelFetcher } from "./default-model-fetcher";
import { audioFileToArray } from "./utils";

export type NonRealTimeDetectionOptionsWeb = {
  modelURL: string;
  modelFetcher: (path: string) => Promise<ArrayBuffer>;
  sampleRate: number;
  minSilenceFrames: number;
} & NonRealTimeDetectionOptions;

export const defaultNonRealTimeDetectionOptions: NonRealTimeDetectionOptionsWeb = {
  modelURL: assetPath("model.onnx"),
  modelFetcher: defaultModelFetcher,
  positiveSpeechThreshold: 0.7,
  negativeSpeechThreshold: 0.3,
  redemptionFrames: 5,
  frameSamples: 1024,
  sampleRate: 16000,
  minSpeechFrames: 10,
  minSilenceFrames: 10,
  preSpeechPadFrames: 5,
  submitUserSpeechOnPause: true,
};

class NonRealTimeDetection extends PlatformAgnosticNonRealTimeDetection {
  static async new(
    options: Partial<NonRealTimeDetectionOptionsWeb> = {},
  ): Promise<NonRealTimeDetection> {
    const { modelURL, modelFetcher } = {
      ...defaultNonRealTimeDetectionOptions,
      ...options,
    };
    const fullOptions: NonRealTimeDetectionOptionsWeb = {
      ...defaultNonRealTimeDetectionOptions,
      ...options,
    };
    return await this._new(() => modelFetcher(modelURL), ort, fullOptions);
  }
}

export const utils = { audioFileToArray, ..._utils };

export { FrameProcessor, Message, NonRealTimeDetection };
export type { FrameProcessorOptions, NonRealTimeDetectionOptions };
export { Detect, AudioNodeDetection, defaultRealTimeDetectionOptions } from "./real-time";
export type { RealTimeDetectionOptions } from "./real-time";
