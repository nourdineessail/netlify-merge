import { makeEmptyPng, registerFont, encodePNGToStream, decodePNGFromStream } from "pureimage";
import fetch from "node-fetch";
import { Readable } from "stream";

async function fetchPngBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("image/png")) throw new Error(`URL does not point to a PNG image: ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const handler = async ({ queryStringParameters }) => {
  const { top, bottom, text } = queryStringParameters || {};
  if (!top||!bottom||!text) return { statusCode:400, body:"Missing params" };

  try {
    // load images with validation
    const [bufTop, bufBot] = await Promise.all([
      fetchPngBuffer(top),
      fetchPngBuffer(bottom),
    ]);
    // decode PNGs from streams
    const imgTop = await decodePNGFromStream(Readable.from(bufTop));
    const imgBot = await decodePNGFromStream(Readable.from(bufBot));
    // ...rest of your code...
    const WIDTH = 1080, BARH = 200;
    const scaledTop = makeEmptyPng(WIDTH, Math.floor(imgTop.height * WIDTH / imgTop.width));
    scaledTop.context.drawImage(imgTop, 0, 0, WIDTH, scaledTop.height);
    const scaledBot = makeEmptyPng(WIDTH, Math.floor(imgBot.height * WIDTH / imgBot.width));
    scaledBot.context.drawImage(imgBot, 0, 0, WIDTH, scaledBot.height);
    // bar
    const bar = makeEmptyPng(WIDTH, BARH);
    bar.context.fillStyle = "#0d1b2a";
    bar.context.fillRect(0, 0, WIDTH, BARH);
    registerFont("Arial.ttf", "Arial");
    bar.context.fillStyle = "#fff";
    bar.context.textAlign = "center";
    bar.context.textBaseline = "middle";
    bar.context.font = "48px Arial";
    bar.context.fillText(text, WIDTH/2, BARH/2);
    // composite
    const totalH = scaledTop.height + BARH + scaledBot.height;
    const canvas = makeEmptyPng(WIDTH, totalH);
    canvas.context.drawImage(scaledTop, 0, 0);
    canvas.context.drawImage(bar,       0, scaledTop.height);
    canvas.context.drawImage(scaledBot, 0, scaledTop.height + BARH);
    // output
    const chunks = [];
    await encodePNGToStream(canvas, { write: c => chunks.push(c) });
    const out = Buffer.concat(chunks);
    return { statusCode:200, headers:{"Content-Type":"image/png"}, body:out.toString("base64"), isBase64Encoded:true };
  } catch (err) {
    return { statusCode:500, body:err.message };
  }
};