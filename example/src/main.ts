/* eslint-disable import/no-unresolved */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { Detect, utils } from "../../dist";
import "./style.css";

async function main() {
  const debug = false;

  const container = document.querySelector(".container")!;

  const title = document.createElement("h1");
  title.textContent = "Voice Activity Detection";
  title.classList.add("title");

  const button = document.createElement("button");
  button.id = "toggleDetection";
  button.textContent = "Start Voice Activity Detection";
  button.classList.add("button", "is-loading");
  button.disabled = true;

  const speechList = document.createElement("ul");
  speechList.id = "audio-list";

  container.appendChild(title);
  container.appendChild(button);
  container.appendChild(speechList);

  const fftSize = 512;

  try {
    const detection = await Detect.new({
      onSpeechStart: () => {
        console.log("Speech start");
      },
      onFFTProcessed: (fftData) => {
        let canvas = document.getElementById("audio-visualizer") as HTMLCanvasElement;
        if (!canvas) {
          canvas = document.createElement("canvas");
          canvas.id = "audio-visualizer";
          canvas.width = fftSize;
          canvas.height = window.innerHeight / 4;
          canvas.style.width = "100%";
          canvas.style.height = "50vh";
          canvas.style.position = "fixed";
          canvas.style.bottom = "5px";
          container.appendChild(canvas);
        }
        const ctx = canvas.getContext("2d")!;

        drawVisualizer(fftData, canvas.width, canvas.height, ctx);
      },
      onMisfire: () => {
        console.log("Detection misfire");
      },
      onFrameProcessed: (data) => {
        if (debug) {
          console.log(data.probabilities);
          console.log(data.fftData);
        }
      },
      onSpeechEnd: (arr: Float32Array) => {
        console.log("Speech end");
        const wavBuffer = utils.encodeWAV(arr);
        const base64 = utils.arrayBufferToBase64(wavBuffer);
        const url = `data:audio/wav;base64,${base64}`;
        const el = addAudio(url);
        speechList.prepend(el);
      },
      fftSize,
      frameSamples: 1536,
    });

    button.classList.remove("is-loading");
    button.disabled = false;

    if (!detection.listening) {
      detection.start();
      button.textContent = "Stop Detection";
    }

    button.addEventListener("click", () => {
      if (detection.listening) {
        detection.pause();
        button.textContent = "Start Detection";
      } else {
        detection.start();
        button.textContent = "Stop Detection";
      }
    });
  } catch (e) {
    console.error("Failed:", e);
  }

  function addAudio(audioUrl: string) {
    const entry = document.createElement("li");
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = audioUrl;
    entry.appendChild(audio);
    audio.play();
    return entry;
  }

  function drawVisualizer(
    fftData: Float32Array,
    width: number,
    height: number,
    ctx: CanvasRenderingContext2D,
  ) {
    const barWidth = Math.max(2, Math.floor(width / fftData.length));
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < fftData.length; i++) {
      const barHeight = Math.max(3, (fftData[i] + 130) * 2);
      const x = i * barWidth;
      const y = height - barHeight;
      const hue = Math.round((i * 360) / fftData.length);
      const lightness = Math.max(33, Math.floor((barHeight / 227) * 100));
      ctx.fillStyle = `hsl(${hue}, 50%, ${lightness}%)`;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  }
}

main();
