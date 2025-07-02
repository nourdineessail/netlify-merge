// netlify/functions/merge.js
const Jimp = require("jimp");

exports.handler = async (event) => {
  const { top, bottom, text } = event.queryStringParameters || {};
  if (!top || !bottom || !text) {
    return { statusCode: 400, body: "Missing top, bottom or text query parameters" };
  }

  try {
    // 1) Load images
    const [imgTop, imgBot] = await Promise.all([
      Jimp.read(top),
      Jimp.read(bottom),
    ]);

    // 2) Resize both to width 1080 (auto height)
    imgTop.resize(1080, Jimp.AUTO);
    imgBot.resize(1080, Jimp.AUTO);

    // 3) Create the bar
    const barHeight = 200;
    const bar = new Jimp(1080, barHeight, 0x0d1b2aff); // ARGB hex

    // 4) Load a font and print the text centered
    //    you can choose any built-in Jimp font
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    bar.print(
      font,
      0,
      0,
      {
        text: text,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
      },
      bar.bitmap.width,
      bar.bitmap.height
    );

    // 5) Create a blank tall image to composite into
    const totalHeight = imgTop.bitmap.height + barHeight + imgBot.bitmap.height;
    const canvas = new Jimp(1080, totalHeight, 0x00000000);

    // 6) Composite top, bar, bottom
    canvas.composite(imgTop, 0, 0);
    canvas.composite(bar,   0, imgTop.bitmap.height);
    canvas.composite(imgBot, 0, imgTop.bitmap.height + barHeight);

    // 7) Get buffer and return as base64
    const outBuf = await canvas.getBufferAsync(Jimp.MIME_PNG);
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png" },
      body: outBuf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server error: " + err.message };
  }
};
