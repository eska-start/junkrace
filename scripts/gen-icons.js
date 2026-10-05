const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const srcImagePath = 'C:/Users/ESKAMINI/.gemini/antigravity-ide/brain/37e1f599-1b91-4198-9d1a-e3a68c795d07/junk_racers_app_icon_1791033874071.jpg';
const outDir = path.resolve(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function generate() {
  console.log('Reading master icon image...');
  const src = sharp(srcImagePath);
  const meta = await src.metadata();
  const W = meta.width; // 1024
  const H = meta.height; // 1024

  // Also backup master icon to public/icons/master-icon.png
  await sharp(srcImagePath)
    .png({ quality: 100 })
    .toFile(path.join(outDir, 'master-icon.png'));
  console.log('Saved master-icon.png');

  // Create rounded corner mask SVG for standard icons (transparent outside corners)
  // Corner radius is ~190 on 1024x1024
  const r = 190;
  const roundedMaskSvg = Buffer.from(
    `<svg width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );

  // 1. Transparent rounded master
  const roundedMasterBuffer = await sharp(srcImagePath)
    .composite([{ input: roundedMaskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 2. Generate standard icon-512.png
  await sharp(roundedMasterBuffer)
    .resize(512, 512, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  // 3. Generate standard icon-192.png
  await sharp(roundedMasterBuffer)
    .resize(192, 192, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-192.png'));
  console.log('Generated icon-192.png');

  // 4. Generate apple-touch-icon.png (180x180)
  // iOS Safari expects a square image without rounded corners (iOS applies its own squircle mask).
  // Fill background with theme dark green #13342b or #203e35
  const appleInnerSize = 166;
  const appleMargin = Math.round((180 - appleInnerSize) / 2);
  const appleInner = await sharp(roundedMasterBuffer)
    .resize(appleInnerSize, appleInnerSize, { kernel: 'lanczos3' })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 19, g: 52, b: 43, alpha: 1 } // #13342b
    }
  })
    .composite([{ input: appleInner, top: appleMargin, left: appleMargin }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 5. Generate maskable icons: icon-maskable-512.png and icon-maskable-192.png
  // Safe zone for maskable icons is 80% circle (radius = 0.4 * size).
  // Inner icon scaled to 78% so golden border and full kart are 100% inside safe zone.
  const maskable512InnerSize = Math.round(512 * 0.80); // ~410px
  const maskable512Offset = Math.round((512 - maskable512InnerSize) / 2); // ~51px

  const maskable512Inner = await sharp(roundedMasterBuffer)
    .resize(maskable512InnerSize, maskable512InnerSize, { kernel: 'lanczos3' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 19, g: 52, b: 43, alpha: 1 } // #13342b
    }
  })
    .composite([{ input: maskable512Inner, top: maskable512Offset, left: maskable512Offset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-maskable-512.png'));
  console.log('Generated icon-maskable-512.png');

  const maskable192InnerSize = Math.round(192 * 0.80);
  const maskable192Offset = Math.round((192 - maskable192InnerSize) / 2);

  const maskable192Inner = await sharp(roundedMasterBuffer)
    .resize(maskable192InnerSize, maskable192InnerSize, { kernel: 'lanczos3' })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 19, g: 52, b: 43, alpha: 1 }
    }
  })
    .composite([{ input: maskable192Inner, top: maskable192Offset, left: maskable192Offset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-maskable-192.png'));
  console.log('Generated icon-maskable-192.png');

  // 6. Generate favicon-32.png and favicon-16.png
  await sharp(roundedMasterBuffer)
    .resize(32, 32, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(outDir, 'favicon-32.png'));
  console.log('Generated favicon-32.png');

  await sharp(roundedMasterBuffer)
    .resize(16, 16, { kernel: 'lanczos3' })
    .png()
    .toFile(path.join(outDir, 'favicon-16.png'));
  console.log('Generated favicon-16.png');

  // 7. Update public/favicon.svg to embed clean high-res base64 or vector
  const fav64Png = await sharp(roundedMasterBuffer).resize(64, 64).png().toBuffer();
  const favSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <image href="data:image/png;base64,${fav64Png.toString('base64')}" width="64" height="64"/>
</svg>`;
  fs.writeFileSync(path.resolve(__dirname, '..', 'public', 'favicon.svg'), favSvgContent, 'utf8');
  console.log('Updated public/favicon.svg');

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
