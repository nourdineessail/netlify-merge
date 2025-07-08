import express from "express";
import axios from "axios";
import sharp from "sharp";

const app   = express();
const PORT  = process.env.PORT || 3000;

/**
 * GET /generate?imgUrl=<url>&title=<text>
 * Returns: PNG image (image–banner–image)
 */
app.get("/generate", async (req, res) => {
  const { imgUrl, title } = req.query;
  if (!imgUrl || !title) {
    return res.status(400).json({ error: "imgUrl and title are required query params" });
  }

  try {
    /* 1. Download original image ------------------------------------------------ */
    const { data }  = await axios.get(imgUrl, { responseType: "arraybuffer" });
    const srcBuffer = Buffer.from(data);

    /* 2. Normalise width so every output is the same width (optional) ----------- */
    const MAX_W   = 1000;          // Pinterest’s long-pin width target
    const topImg  = await sharp(srcBuffer).resize({ width: MAX_W }).toBuffer();
    const { width, height } = await sharp(topImg).metadata();

    /* 3. Build the blue banner as an SVG overlay -------------------------------- */
    const bannerHeight = Math.round(height * 0.15);   // ±15 % of img height
    const bannerSVG = `
      <svg width="${width}" height="${bannerHeight}">
        <rect x="0" y="0" width="100%" height="100%" fill="#0a557c" />
        <text x="50%" y="50%"
              alignment-baseline="middle"
              text-anchor="middle"
              font-family="sans-serif"
              font-size="${Math.round(bannerHeight * 0.45)}"
              font-weight="700"
              fill="#ffffff">
          ${title.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
        </text>
      </svg>`;

    const bannerBuf = Buffer.from(bannerSVG);

    /* 4. Compose: top image + banner + bottom image ----------------------------- */
    const totalHeight = height * 2 + bannerHeight;
    const final = await sharp({
        create: { width, height: totalHeight, channels: 3, background: "#ffffff" }
      })
      .composite([
        { input: topImg,       top: 0,              left: 0 },
        { input: bannerBuf,    top: height,         left: 0 },
        { input: topImg,       top: height + bannerHeight, left: 0 }
      ])
      .png()
      .toBuffer();

    /* 5. Send PNG --------------------------------------------------------------- */
    res.set("Content-Type", "image/png");
    res.send(final);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image generation failed" });
  }
});

app.listen(PORT, () => console.log(`Image-banner API listening on ${PORT}`));
