// functions/generate.js  (CommonJS – simpler on Netlify)
const axios = require("axios");
const sharp = require("sharp");
const fs    = require("fs");
const path  = require("path");

/* -------------------- Fontconfig so Pango can see Inter ------------------- */
process.env.FONTCONFIG_FILE = path.join(__dirname, "fonts", "fonts.conf");
process.env.FONTCONFIG_PATH = path.dirname(process.env.FONTCONFIG_FILE);

/* -------------------- Embed Inter-Bold inside the SVG --------------------- */
const inter = fs.readFileSync(
  path.join(__dirname, "fonts", "Inter-Bold.ttf")
).toString("base64");

/* -------------------- Tiny helper to escape HTML, not URL ----------------- */
const htmlEscape = (str) =>
  str.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/* -------------------------------------------------------------------------- */
exports.handler = async (event) => {
  const { imgUrl, title, bannerColor = "#0a557c" } = event.queryStringParameters || {};

  if (!imgUrl || !title) {
    return { statusCode: 400, body: "imgUrl and title are required" };
  }

  try {
    /* 1 – download & resize--------------------------------------------------- */
    const { data } = await axios.get(imgUrl, { responseType: "arraybuffer" });
    const srcBuf   = Buffer.from(data);
    const MAX_W    = 1000;

    const topImg = await sharp(srcBuf).resize({ width: MAX_W }).toBuffer();
    const { width, height } = await sharp(topImg).metadata();

    /* 2 – build banner SVG --------------------------------------------------- */
    const bannerH   = Math.round(height * 0.15);      // teal strip height
    const safeTitle = htmlEscape(title);

    /* ----- pick a font-size that fits the banner -------------------------- */
    let fontSize      = Math.round(bannerH * 0.50);   // start at 50 % of banner
    const maxTextW    = width * 0.90;                 // keep 5 % padding each side
    const estTextW    = safeTitle.length * fontSize * 0.55; // crude width guess
    if (estTextW > maxTextW) {
      fontSize = Math.floor(maxTextW / (safeTitle.length * 0.55));
    }

    const bannerSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${bannerH}">
        <defs>
          <style>
            @font-face{
              font-family:'InterBold';
              font-weight:700;
              src:url(data:font/ttf;base64,${inter}) format('truetype');
            }
            text{font-family:'InterBold'}
          </style>
        </defs>
        <rect width="100%" height="100%" fill="${bannerColor}"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            dy=".30em"  font-size="${fontSize}" fill="#fff">
          ${safeTitle}
        </text>
      </svg>`;
    const bannerBuf = Buffer.from(bannerSVG);

    /* 3 – compose ----------------------------------------------------------- */
    const out = await sharp({
        create: { width, height: height * 2 + bannerH, channels: 3, background: "#fff" }
      })
      .composite([
        { input: topImg,    top: 0,               left: 0 },
        { input: bannerBuf, top: height,          left: 0 },
        { input: topImg,    top: height + bannerH, left: 0 }
      ])
      .jpeg()
      .toBuffer();

    /* 4 – return binary ------------------------------------------------------ */
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/jpeg" },
      isBase64Encoded: true,
      body: out.toString("base64"),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Image generation failed" };
  }
};
