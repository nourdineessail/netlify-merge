import { make, registerFont, encodePNGToStream, decodePNGFromStream } from "pureimage";
import fetch from "node-fetch";
import { Readable } from "stream";
import Jimp from "jimp";

async function decodeImage(buffer, contentType) {
    if (contentType.includes("png")) {
        return await decodePNGFromStream(Readable.from(buffer));
    } else if (contentType.includes("jpeg")) {
        // Use Jimp for JPEGs, then convert to pureimage bitmap
        const jimpImg = await Jimp.read(buffer);
        const bmp = make(jimpImg.bitmap.width, jimpImg.bitmap.height);
        const ctx = bmp.getContext('2d');
        // Pureimage's putImageData expects an object with width, height, and data (Uint8ClampedArray)
        const imageData = {
            width: jimpImg.bitmap.width,
            height: jimpImg.bitmap.height,
            data: new Uint8ClampedArray(jimpImg.bitmap.data)
        };
        ctx.putImageData(imageData, 0, 0);
        return bmp;
    } else {
        throw new Error("Unsupported image type");
    }
}

async function fetchImageBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("image/png") && !contentType.includes("image/jpeg")) {
        throw new Error(`URL does not point to a PNG or JPEG image: ${url}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType };
}

export const handler = async ({ queryStringParameters }) => {
    const { top, bottom, text } = queryStringParameters || {};
    if (!top || !bottom || !text) return { statusCode: 400, body: "Missing params" };

    try {
        const [imgTopData, imgBotData] = await Promise.all([
            fetchImageBuffer(top),
            fetchImageBuffer(bottom),
        ]);
        const imgTop = await decodeImage(imgTopData.buffer, imgTopData.contentType);
        const imgBot = await decodeImage(imgBotData.buffer, imgBotData.contentType);

        // Validate images
        if (!imgTop || !imgTop.width || !imgTop.height) {
            throw new Error("Failed to decode top image");
        }
        if (!imgBot || !imgBot.width || !imgBot.height) {
            throw new Error("Failed to decode bottom image");
        }
        const WIDTH = 1080, BARH = 200;
        const scaledTop = make(WIDTH, Math.floor(imgTop.height * WIDTH / imgTop.width));
        const ctxTop = scaledTop.getContext('2d');
        if (!ctxTop) throw new Error("scaledTop.getContext('2d') is undefined");
        ctxTop.drawImage(imgTop, 0, 0, WIDTH, scaledTop.height);

        const scaledBot = make(WIDTH, Math.floor(imgBot.height * WIDTH / imgBot.width));
        const ctxBot = scaledBot.getContext('2d');
        if (!ctxBot) throw new Error("scaledBot.getContext('2d') is undefined");
        ctxBot.drawImage(imgBot, 0, 0, WIDTH, scaledBot.height);

        // bar
        const bar = make(WIDTH, BARH);
        const ctxBar = bar.getContext('2d');
        ctxBar.fillStyle = "#0d1b2a";
        ctxBar.fillRect(0, 0, WIDTH, BARH);
        registerFont("Arial.ttf", "Arial");
        ctxBar.fillStyle = "#fff";
        ctxBar.textAlign = "center";
        ctxBar.textBaseline = "middle";
        ctxBar.font = "48px Arial";
        ctxBar.fillText(text, WIDTH / 2, BARH / 2);

        // composite
        const totalH = scaledTop.height + BARH + scaledBot.height;
        const canvas = make(WIDTH, totalH);
        const ctxCanvas = canvas.getContext('2d');

        // Draw scaled top image
        ctxCanvas.drawImage(imgTop, 0, 0, imgTop.width, imgTop.height, 0, 0, WIDTH, scaledTop.height);
        // Draw bar
        ctxCanvas.drawImage(bar, 0, scaledTop.height);
        // Draw scaled bottom image
        ctxCanvas.drawImage(imgBot, 0, 0, imgBot.width, imgBot.height, 0, scaledTop.height + BARH, WIDTH, scaledBot.height);

        // output
        const chunks = [];
        await encodePNGToStream(canvas, { write: c => chunks.push(c) });
        const out = Buffer.concat(chunks);
        return { statusCode: 200, headers: { "Content-Type": "image/png" }, body: out.toString("base64"), isBase64Encoded: true };
    } catch (err) {
        return { statusCode: 500, body: err.message };
    }
};