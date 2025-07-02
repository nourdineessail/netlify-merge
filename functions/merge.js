// netlify/functions/merge.js
import { readImage, makeEmptyPng, registerFont } from "pureimage";
import { encodePNGToStream } from "pureimage";
import fetch from "node-fetch";

export const handler = async ({ queryStringParameters }) => {
  const { top, bottom, text } = queryStringParameters || {};
  if (!top||!bottom||!text) return { statusCode:400, body:"Missing params" };

  // load images
  const [bufTop, bufBot] = await Promise.all([
    fetch(top).then(r=>r.arrayBuffer()).then(b=>Buffer.from(b)),
    fetch(bottom).then(r=>r.arrayBuffer()).then(b=>Buffer.from(b)),
  ]);
  const imgTop = await readImage(bufTop);
  const imgBot = await readImage(bufBot);
  // resize (naive nearest-neighbor)
  const WIDTH = 1080, BARH = 200;
  const scaledTop = makeEmptyPng(WIDTH, Math.floor(imgTop.height * WIDTH / imgTop.width));
  scaledTop.context.drawImage(imgTop, 0, 0, WIDTH, scaledTop.height);
  const scaledBot = makeEmptyPng(WIDTH, Math.floor(imgBot.height * WIDTH / imgBot.width));
  scaledBot.context.drawImage(imgBot, 0, 0, WIDTH, scaledBot.height);
  // bar
  const bar = makeEmptyPng(WIDTH, BARH);
  bar.context.fillStyle = "#0d1b2a";
  bar.context.fillRect(0, 0, WIDTH, BARH);
  registerFont("Arial.ttf", "Arial"); // you need to bundle a .ttf
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
};
