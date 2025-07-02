// netlify/functions/merge.js
const sharp = require("sharp");

exports.handler = async (event) => {
  const { top, bottom, text } = event.queryStringParameters || {};
  if (!top || !bottom || !text) {
    return { statusCode: 400, body: "Missing top, bottom or text query parameters" };
  }

  try {
    // 1) Fetch the two images using native fetch
    const [respTop, respBot] = await Promise.all([
      fetch(top),
      fetch(bottom),
    ]);
    if (!respTop.ok || !respBot.ok) {
      throw new Error("Failed to download one of the images");
    }
    const [bufTop, bufBot] = await Promise.all([
      respTop.arrayBuffer().then((ab) => Buffer.from(ab)),
      respBot.arrayBuffer().then((ab) => Buffer.from(ab)),
    ]);

    // 2) Create an SVG bar with your text
    const svgBar = `
      <svg width="1080" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#0d1b2a"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              font-size="48" fill="#ffffff" font-family="Arial, sans-serif">
          ${text.replace(/&/g, "&amp;")}
        </text>
      </svg>`;

    // 3) Resize & buffer each part
    const topBuf  = await sharp(bufTop).resize(1080).png().toBuffer();
    const barBuf  = await sharp(Buffer.from(svgBar)).png().toBuffer();
    const botBuf  = await sharp(bufBot).resize(1080).png().toBuffer();

    // 4) Get heights so we can calculate total canvas height
    const { height: topH } = await sharp(topBuf).metadata();
    const { height: botH } = await sharp(botBuf).metadata();
    const barH = 200; // we set SVG height to 200

    // 5) Composite them vertically
    const finalBuf = await sharp({
      create: {
        width: 1080,
        height: topH + barH + botH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: topBuf, top: 0,           left: 0 },
        { input: barBuf, top: topH,       left: 0 },
        { input: botBuf, top: topH + barH, left: 0 },
      ])
      .png()
      .toBuffer();

    // 6) Return as a base64-encoded PNG so Make can ingest it
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png" },
      body: finalBuf.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Server error: " + err.message };
  }
};
