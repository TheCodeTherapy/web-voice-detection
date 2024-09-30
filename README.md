# Web Voice Detection

![Web Voice Detection](https://raw.githubusercontent.com/TheCodeTherapy/web-voice-detection/b751bedcde49e1bc4db9c478a155b7f8940d788b/assets/screenshot.png)

This project demonstrates real-time voice activity detection in a web browser using a pre-trained ONNX model with WebAssembly. It captures audio from the user's microphone, processes it to identify speech segments, and provides callbacks for speech start and end events, among some other potentially useful data.

Please feel free to ask me questions about it (or to tweet me memes) on X [@TheCodeTherapy](https://x.com/TheCodeTherapy)

## Live Demo

### You can check the demo running live [here](https://thecodetherapy.github.io/test-voice-detection/).

The Live Demo app repository can be found [here](https://github.com/TheCodeTherapy/test-voice-detection).

## Features

- Real-time voice detection using a pre-trained ONNX model.
- Real-time FFT data to generate audio visualizers.
- Customizable audio constraints and Detection parameters.
- Callbacks for speech start, speech end, and misfire events.
- Integration with Web Audio API for audio processing.

## Usage

- Install the package

```bash
npm install web-voice-detection
```

- Usage example

```typescript
const detection = await Detect.new({
  onSpeechStart: () => {
    statusDiv.textContent = "Speech detected!";
  },
  onSpeechEnd: (arr: Float32Array) => {
    statusDiv.textContent = "Speech ended.";

    // uses provided util to encode WAV from the Float32Array
    const wavBuffer = utils.encodeWAV(arr);
    // converts array buffer to base64 string
    const base64 = utils.arrayBufferToBase64(wavBuffer);
    // converts to base64 data URL
    const url = `data:audio/wav;base64,${base64}`;
    // do whatever you want with the wav audio url
    appendAudioElement(url);
  },
  onMisfire: () => {
    statusDiv.textContent = "Misfire!";
  },
  onFFTProcessed: (fftData) => {
    // you can use the FFT data to draw a visualizer
  },
  fftSize: 1024, // whatever reasonable size you want
});
```

### Configuration

You can customize the behavior of Detect using various options. Refer to the RealTimeDetectionOptions type definition for a complete list of available options. Some key options include:

- `onFrameProcessed`: Callback function that receives audio frame data with the Detection probabilities as the follwing object: `{ notSpeech: number, isSpeech: number }`.

- `onFFTProcessed`: Callback function that receives the audio FFT array based on the `fftSize` option passed to the constructor.

- `onSpeechStart`: Callback function triggered when speech starts.

- `onSpeechEnd`: Callback function triggered when speech ends.

- `onMisfire`: Callback function triggered if a speech start is detected but the segment is too short.

- `frameSamples`: Number of audio samples per frame (default: `1536`).

- `positiveSpeechThreshold`: Probability threshold for detecting speech (default: 0.5).

- `negativeSpeechThreshold`: Probability threshold for detecting non-speech (default: 0.35).


## Diving into the source code

### To check the example code running on your browser from source locally:

```bash
git clone https://github.com/TheCodeTherapy/web-voice-detection.git

cd web-voice-detection

nvm install $(cat .nvmrc)

npm install

npm run watch:example
```

### Examples

The example directory contains a basic example demonstrating how to use the Detect class.

You can also check a the demo repository that consumes this library as an npm package [here](https://github.com/TheCodeTherapy/test-voice-detection).

### License

This project is licensed under the MIT License
