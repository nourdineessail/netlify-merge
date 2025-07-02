// netlify/functions/merge.js
const Jimp = require("jimp");  // now works with v0.16.x

exports.handler = async (event) => {
  const { top, bottom, text } = event.queryStringParameters || {};
  if (!top || !bottom || !text) {
    return { statusCode: 400, body: "Missing top, bottom or text query parameters" };
  }
  try {
    // load & resize
    const [imgTop, imgBot] = await Promise.all([
      Jimp.read(top).then(i => i.resize(1080, Jimp.AUTO)),
      Jimp.read(bottom).then(i => i.resize(1080, Jimp.AUTO)),
    ]);
    // create bar
    const barH = 200;
    const bar = await new Jimp(1080, barH, 0x0d1b2aff);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    bar.print(font, 0, 0, { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, 1080, barH);
    // composite
    const canvasH = imgTop.bitmap.height + barH + imgBot.bitmap.height;
    const canvas = await new Jimp(1080, canvasH, 0x00000000);
    canvas.composite(imgTop, 0, 0).composite(bar, 0, imgTop.bitmap.height).composite(imgBot, 0, imgTop.bitmap.height + barH);
    // output
    const buf = await canvas.getBufferAsync(Jimp.MIME_PNG);
    return { statusCode: 200, headers: {"Content-Type":"image/png"}, body: buf.toString("base64"), isBase64Encoded: true };
  } catch(err) {
    console.error(err);
    return { statusCode: 500, body: "Server error: "+err.message };
  }
};
