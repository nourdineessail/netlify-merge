// functions/generate.js  (CommonJS – simpler on Netlify)
const axios  = require("axios");
const sharp  = require("sharp");
const fs   = require("fs");
const path = require("path");

process.env.FONTCONFIG_FILE = path.join(__dirname, "fonts.conf");

const inter = fs.readFileSync(path.join("./fonts", "Inter-Bold.ttf"))
                .toString("base64");

/**
 * Lambda signature
 * - event.queryStringParameters holds the ?imgUrl= & ?title=
 */
exports.handler = async (event) => {
  const { imgUrl, title } = event.queryStringParameters || {};

  if (!imgUrl || !title) {
    return { statusCode: 400, body: "imgUrl and title are required" };
  }

  try {
    /* 1 – download & resize ---------------------------------------------------- */
    const { data }  = await axios.get(imgUrl, { responseType: "arraybuffer" });
    const srcBuf    = Buffer.from(data);
    const MAX_W     = 1000;
    const topImg    = await sharp(srcBuf).resize({ width: MAX_W }).toBuffer();
    const { width, height } = await sharp(topImg).metadata();

    /* 2 – banner SVG ----------------------------------------------------------- */
    const bannerH = Math.round(height * 0.15);
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
      <rect width="100%" height="100%" fill="#0a557c"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-size="${Math.round(bannerH*0.45)}" fill="#fff">
        ${escape(title)}
      </text>
    </svg>`;
    const bannerBuf = Buffer.from(bannerSVG);

    /* 3 – compose ------------------------------------------------------------- */
    const out = await sharp({
        create:{width,height:height*2+bannerH,channels:3,background:"#fff"}
      })
      .composite([
        { input: topImg,           top: 0,              left: 0 },
        { input: bannerBuf,        top: height,         left: 0 },
        { input: topImg,           top: height+bannerH, left: 0 }
      ])
      .png().toBuffer();

    /* 4 – return binary (base64) --------------------------------------------- */
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png" },
      isBase64Encoded: true,               // **important**
      body: out.toString("base64")
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Image generation failed" };
  }
};
