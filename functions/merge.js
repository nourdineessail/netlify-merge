// netlify/functions/merge.js

exports.handler = async (event) => {
  // 1) Dynamically import Jimp so we get the default ESM export
  const { default: Jimp } = await import("jimp");

  const { top, bottom, text } = event.queryStringParameters || {};
  if (!top || !bottom || !text) {
    return { statusCode: 400, body: "Missing top, bottom or text query parameters" };
  }

  try {
    // 2) Load & resize images
    const [imgTop, imgBot] = await Promise.all([
      Jimp.read(top).then(img => img.resize(1080, Jimp.AUTO)),
      Jimp.read(bottom).then(img => img.resize(1080, Jimp.AUTO)),
    ]);

    // 3) Make bar
    const barHeight = 200;
    const bar = new Jimp(1080, barHeight, 0x0d1b2aff);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    bar.print(
      font,
      0, 0,
      { text, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE },
      bar.bitmap.width,
      bar.bitmap.height
    );

    // 4) Composite
    const totalHeight = imgTop.bitmap.height + barHeight + imgBot.bitmap.height;
    const canvas = new Jimp(1080, totalHeight, 0x00000000);
    canvas.composite(imgTop, 0, 0)
          .composite(bar,   0, imgTop.bitmap.height)
          .composite(imgBot, 0, imgTop.bitmap.height + barHeight);

    // 5) Output as base64 PNG
    const out = await canvas.getBufferAsync(Jimp.MIME_PNG);
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png" },
      body: out.toString("base64"),
      isBase64Encoded: true,
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server error: " + err.message };
  }
};
