import * as ortInstance from "onnxruntime-web";

import { assetPath } from "./asset-path";
import {
  defaultFrameProcessorOptions,
  FrameProcessor,
  FrameProcessorOptions,
  log,
  Message,
  ONNXModel,
  OrtOptions,
  SpeechProbabilities,
  validateOptions,
} from "./common";
import { defaultModelFetcher } from "./default-model-fetcher";

type RealTimeDetectionCallbacks = {
  onFrameProcessed: (data: FrameData) => any;
  onMisfire: () => any;
  onSpeechStart: () => any;
  onSpeechEnd: (audio: Float32Array) => any;
  onFFTProcessed: (fftData: Float32Array) => any;
  fftSize: number;
};

type AudioConstraints = Omit<
  MediaTrackConstraints,
  "channelCount" | "echoCancellation" | "autoGainControl" | "noiseSuppression"
>;

type AssetOptions = {
  workletURL: string;
  modelURL: string;
  modelFetcher: (path: string) => Promise<ArrayBuffer>;
};

type RealTimeDetectionOptionsWithoutStream = {
  additionalAudioConstraints?: AudioConstraints;
  stream: undefined;
} & FrameProcessorOptions &
  RealTimeDetectionCallbacks &
  OrtOptions &
  AssetOptions;

type RealTimeDetectionOptionsWithStream = {
  stream: MediaStream;
} & FrameProcessorOptions &
  RealTimeDetectionCallbacks &
  OrtOptions &
  AssetOptions;

export const ort = ortInstance;

export type RealTimeDetectionOptions =
  | RealTimeDetectionOptionsWithStream
  | RealTimeDetectionOptionsWithoutStream;

type FrameData = {
  probabilities: SpeechProbabilities;
  fftData: Float32Array;
};

export const defaultRealTimeDetectionOptions: RealTimeDetectionOptions = {
  ...defaultFrameProcessorOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onFrameProcessed: (data: FrameData) => {},
  onMisfire: () => {
    log.debug("Detection misfire");
  },
  onSpeechStart: () => {
    log.debug("Detected speech start");
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSpeechEnd: (audio: Float32Array) => {
    log.debug("Detected speech end");
  },
  fftSize: 1024,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onFFTProcessed: (fftData: Float32Array) => {},
  workletURL: assetPath("worklet.js"),
  modelURL: assetPath("model.onnx"),
  modelFetcher: defaultModelFetcher,
  stream: undefined,
  ortConfig: undefined,
};

export class Detect {
  static async new(options: Partial<RealTimeDetectionOptions> = {}) {
    const fullOptions: RealTimeDetectionOptions = {
      ...defaultRealTimeDetectionOptions,
      ...options,
    };
    validateOptions(fullOptions);

    let stream: MediaStream;
    if (fullOptions.stream === undefined)
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...fullOptions.additionalAudioConstraints,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      });
    else stream = fullOptions.stream;

    const audioContext = new AudioContext();
    const sourceNode = new MediaStreamAudioSourceNode(audioContext, {
      mediaStream: stream,
    });
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = fullOptions.fftSize;
    sourceNode.connect(analyserNode);

    const audioNodeDetection = await AudioNodeDetection.new(
      audioContext,
      fullOptions,
      analyserNode,
    );
    audioNodeDetection.receive(sourceNode);

    return new Detect(
      fullOptions,
      audioContext,
      stream,
      audioNodeDetection,
      sourceNode,
      analyserNode,
    );
  }

  private constructor(
    public options: RealTimeDetectionOptions,
    private audioContext: AudioContext,
    private stream: MediaStream,
    private audioNodeDetection: AudioNodeDetection,
    private sourceNode: MediaStreamAudioSourceNode,
    public analyserNode: AnalyserNode,
    public listening = false,
  ) {}

  pause = () => {
    this.audioNodeDetection.pause();
    this.listening = false;
  };

  start = () => {
    this.audioNodeDetection.start();
    this.listening = true;
  };

  destroy = () => {
    if (this.listening) {
      this.pause();
    }
    if (this.options.stream === undefined) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.sourceNode.disconnect();
    this.audioNodeDetection.destroy();
    this.audioContext.close();
  };
}

export class AudioNodeDetection {
  static async new(
    ctx: AudioContext,
    options: Partial<RealTimeDetectionOptions> = {},
    analyserNode: AnalyserNode,
  ) {
    const fullOptions: RealTimeDetectionOptions = {
      ...defaultRealTimeDetectionOptions,
      ...options,
    };
    validateOptions(fullOptions);

    if (fullOptions.ortConfig !== undefined) {
      fullOptions.ortConfig(ort);
    }

    try {
      await ctx.audioWorklet.addModule(fullOptions.workletURL);
    } catch (e) {
      console.error("Error loading worklet.");
      console.error(`Make sure worklet is available at specified path: ${fullOptions.workletURL}`);
      console.error("You can customize the worklet path using the `workletURL` option");
      throw e;
    }
    const detectionNode = new AudioWorkletNode(ctx, "voice-worklet", {
      processorOptions: {
        frameSamples: fullOptions.frameSamples,
      },
    });

    let model: ONNXModel;
    try {
      model = await ONNXModel.new(ort, () => fullOptions.modelFetcher(fullOptions.modelURL));
    } catch (e) {
      console.error("Error loading onnx model file.");
      console.error(`Make sure model.onnx is available at specified path: ${fullOptions.modelURL}`);
      console.error("You can customize the model path using the `modelsURL` option");
      throw e;
    }

    const frameProcessor = new FrameProcessor(model.process, model.reset_state, {
      frameSamples: fullOptions.frameSamples,
      positiveSpeechThreshold: fullOptions.positiveSpeechThreshold,
      negativeSpeechThreshold: fullOptions.negativeSpeechThreshold,
      redemptionFrames: fullOptions.redemptionFrames,
      preSpeechPadFrames: fullOptions.preSpeechPadFrames,
      minSpeechFrames: fullOptions.minSpeechFrames,
      submitUserSpeechOnPause: fullOptions.submitUserSpeechOnPause,
    });

    const audioNodeDetection = new AudioNodeDetection(
      ctx,
      fullOptions,
      frameProcessor,
      detectionNode,
      analyserNode,
    );

    detectionNode.port.onmessage = async (ev: MessageEvent) => {
      switch (ev.data?.message) {
        case Message.AudioFrame: {
          const buffer: ArrayBuffer = ev.data.data;
          const frame = new Float32Array(buffer);
          await audioNodeDetection.processFrame(frame);
          break;
        }

        default:
          break;
      }
    };

    return audioNodeDetection;
  }

  private isProcessing = false;

  constructor(
    public ctx: AudioContext,
    public options: RealTimeDetectionOptions,
    private frameProcessor: FrameProcessor,
    private entryNode: AudioWorkletNode,
    private analyserNode: AnalyserNode,
  ) {}

  pause = () => {
    const ev = this.frameProcessor.pause();
    this.isProcessing = false;
    this.handleFrameProcessorEvent(ev);
  };

  start = () => {
    this.frameProcessor.resume();
    this.isProcessing = true;
    this.processFFT();
  };

  receive = (node: AudioNode) => {
    node.connect(this.entryNode);
  };

  processFrame = async (frame: Float32Array) => {
    const ev = await this.frameProcessor.process(frame);
    this.handleFrameProcessorEvent(ev);
  };

  handleFrameProcessorEvent = (
    ev: Partial<{
      probs: SpeechProbabilities;
      msg: Message;
      audio: Float32Array;
    }>,
  ) => {
    const fftBuffer = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatFrequencyData(fftBuffer);

    const frameData: FrameData = {
      probabilities: ev.probs!,
      fftData: fftBuffer,
    };

    if (ev.probs !== undefined) {
      this.options.onFrameProcessed(frameData);
    }

    switch (ev.msg) {
      case Message.SpeechStart:
        this.options.onSpeechStart();
        break;

      case Message.Misfire:
        this.options.onMisfire();
        break;

      case Message.SpeechEnd:
        this.options.onSpeechEnd(ev.audio as Float32Array);
        break;

      default:
        break;
    }
  };

  private processFFT = () => {
    const fftBuffer = new Float32Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getFloatFrequencyData(fftBuffer);
    this.options.onFFTProcessed(fftBuffer);
    if (this.isProcessing) {
      requestAnimationFrame(this.processFFT.bind(this));
    }
  };

  destroy = () => {
    this.entryNode.port.postMessage({
      message: Message.SpeechStop,
    });
    this.entryNode.disconnect();
  };
}
