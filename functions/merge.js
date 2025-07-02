// netlify/functions/merge.js
const fetch = require('node-fetch');
const sharp = require('sharp');

exports.handler = async (event) => {
  const { top, bottom, text } = event.queryStringParameters;
  if (!top||!bottom||!text) return { statusCode:400, body:'Missing params' };

  // 1) Fetch the two images
  const [bufTop, bufBot] = await Promise.all([
    fetch(top).then(r=>r.buffer()),
    fetch(bottom).then(r=>r.buffer())
  ]);

  // 2) Make an SVG bar with your text
  const svgBar = `
    <svg width="1080" height="200">
      <rect width="100%" height="100%" fill="#0d1b2a"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
            font-size="48" fill="#fff" font-family="Arial, sans-serif">
        ${text.replace(/&/g,'&amp;')}
      </text>
    </svg>`;

  // 3) Composite top + bar + bottom
  const topImg = sharp(bufTop).resize(1080).png().toBuffer();
  const barImg = sharp(Buffer.from(svgBar)).png().toBuffer();
  const botImg = sharp(bufBot).resize(1080).png().toBuffer();

  const [t,b,bot] = await Promise.all([topImg, barImg, botImg]);

  const final = await sharp({
      create: { width:1080, height: t.height +200 + bot.height, channels:4, background:{r:0, g:0, b:0, alpha:0} }
    })
    .composite([
      { input: t, top: 0, left: 0 },
      { input: b, top: (await sharp(t).metadata()).height, left: 0 },
      { input: bot, top: (await sharp(t).metadata()).height + 200, left: 0 }
    ])
    .png()
    .toBuffer();

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'image/png' },
    body: final.toString('base64'),
    isBase64Encoded: true
  };
};
