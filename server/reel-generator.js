const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const { createCanvas } = require("@napi-rs/canvas");

async function createReel({ title, script = "", imageUrl, imageUrls = [], duration = 12 }) {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "daily-frame-"));
  const output = path.join(work, "daily-frame-reel.mp4");
  const imagePath = path.join(work, "background.jpg");
  const overlayPath = path.join(work, "overlay.png");

  try {
    const requestedImages = [...new Set([...(Array.isArray(imageUrls) ? imageUrls : []), ...(imageUrl ? [imageUrl] : [])])].slice(0, 6);
    const scenePaths = [];
    for (let i = 0; i < requestedImages.length; i++) {
        const response = await fetch(requestedImages[i]);
        if (!response.ok) throw new Error("Could not download a scene image.");
        const type = response.headers.get("content-type") || "";
        if (!type.startsWith("image/")) throw new Error("A scene URL did not return an image.");
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > 15 * 1024 * 1024) throw new Error("A scene image is too large.");
        const scenePath = i === 0 ? imagePath : path.join(work, `scene-${i + 1}.jpg`);
        await fs.writeFile(scenePath, bytes);
        scenePaths.push(scenePath);
    }

    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, "rgba(8,12,24,0.18)");
    gradient.addColorStop(0.45, "rgba(8,12,24,0.48)");
    gradient.addColorStop(1, "rgba(8,12,24,0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.textAlign = "center";
    ctx.fillStyle = "#d7c3ff";
    ctx.font = "bold 38px sans-serif";
    ctx.fillText("DAILY FRAME", 540, 190);

    const words = String(title || "Ideas worth sharing")
      .replace(/\s+/g, " ").trim().slice(0, 180).split(" ");
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 68px sans-serif";
    let line = "";
    let y = 820;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > 900 && line) {
        ctx.fillText(line, 540, y);
        y += 86;
        line = word;
      } else line = test;
    }
    if (line) ctx.fillText(line, 540, y);

    const scriptWords = String(script || "").replace(/\s+/g, " ").trim().slice(0, 420).split(" ");
    ctx.fillStyle = "#e8edf5";
    ctx.font = "42px sans-serif";
    let scriptLine = "";
    let scriptY = Math.max(y + 130, 1120);
    for (const word of scriptWords) {
      const test = scriptLine ? scriptLine + " " + word : word;
      if (ctx.measureText(test).width > 800 && scriptLine) {
        if (scriptY < 1600) ctx.fillText(scriptLine, 540, scriptY);
        scriptY += 58;
        scriptLine = word;
      } else scriptLine = test;
    }
    if (scriptLine && scriptY < 1600) ctx.fillText(scriptLine, 540, scriptY);

    ctx.fillStyle = "#d7e2ee";
    ctx.font = "30px sans-serif";
    ctx.fillText("POVs, ideas & things worth sharing", 540, 1770);
    await fs.writeFile(overlayPath, canvas.toBuffer("image/png"));

    const args = ["-y"];
    if (imageUrl) {
      args.push("-loop", "1", "-i", imagePath);
    } else {
      args.push("-f", "lavfi", "-i", `color=c=0x10121a:s=1080x1920:r=24:d=${duration}`);
    }
    args.push("-i", overlayPath);
    if (imageUrl) {
      args.push("-filter_complex",
        `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.08)':d=${Math.round(duration * 24)}:s=1080x1920:fps=24[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`,
        "-map", "[v]");
    } else {
      args.push("-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]", "-map", "[v]");
    }
    args.push("-t", String(Math.min(30, Math.max(5, duration))),
      "-c:v", "libx264", "-preset", "ultrafast", "-movflags", "+faststart",
      "-an", output);

    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let error = "";
      proc.stderr.on("data", chunk => { error += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", code => code === 0 ? resolve() : reject(new Error(error.slice(-1200) || "FFmpeg failed.")));
    });

    return { output, work };
  } catch (error) {
    await fs.rm(work, { recursive: true, force: true });
    throw error;
  }
}

module.exports = { createReel };
