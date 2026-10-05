const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourcePath = 'C:/Users/ESKAMINI/.gemini/antigravity-ide/brain/17c183a3-faca-4eab-b2a4-a2b8a372c9b9/junk_racers_fullbleed_1791034174807.jpg';
const outDir = path.resolve(__dirname, '..', 'public', 'icons');
const publicDir = path.resolve(__dirname, '..', 'public');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  console.log('Loading source image:', sourcePath);
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels; // 4 (RGBA)

  // Target background color from the edges: #0b3129 (11, 49, 41)
  const bgR = 11;
  const bgG = 49;
  const bgB = 41;

  // Flood fill corner white areas with the dark teal background color
  const visited = new Uint8Array(w * h);
  const queue = [0, w - 1, (h - 1) * w, h * w - 1];
  for (const q of queue) visited[q] = 1;

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);

    // Replace color
    const idx = curr * channels;
    data[idx] = bgR;
    data[idx + 1] = bgG;
    data[idx + 2] = bgB;
    data[idx + 3] = 255;

    // Check 4-connected neighbors
    const neighbors = [];
    if (cx > 0) neighbors.push(curr - 1);
    if (cx < w - 1) neighbors.push(curr + 1);
    if (cy > 0) neighbors.push(curr - w);
    if (cy < h - 1) neighbors.push(curr + w);

    for (const n of neighbors) {
      if (!visited[n]) {
        const nIdx = n * channels;
        const nr = data[nIdx];
        const ng = data[nIdx + 1];
        const nb = data[nIdx + 2];
        // If near white (corner artifact outside the squircle)
        if (nr > 210 && ng > 210 && nb > 210) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  console.log(`Replaced ${head} corner pixels with seamless background.`);

  // Create base 1024x1024 clean buffer
  const cleanBase = await sharp(data, {
    raw: { width: w, height: h, channels: 4 }
  }).png().toBuffer();

  // 1. Standard icons: full bleed square with subtle rounded edge crop if desired, or crisp square
  console.log('Generating icon-512.png...');
  await sharp(cleanBase)
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-512.png'));

  console.log('Generating master-icon.png (512x512)...');
  await sharp(cleanBase)
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'master-icon.png'));

  console.log('Generating icon-192.png...');
  await sharp(cleanBase)
    .resize(192, 192, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-192.png'));

  console.log('Generating apple-touch-icon.png (180x180)...');
  await sharp(cleanBase)
    .resize(180, 180, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, 'apple-touch-icon.png'));

  // 2. Maskable icons (scaled down to 82% safe zone with #0b3129 background padding)
  const makeMaskable = async (targetSize) => {
    const innerSize = Math.round(targetSize * 0.82);
    const innerBuffer = await sharp(cleanBase)
      .resize(innerSize, innerSize, { kernel: sharp.kernel.lanczos3 })
      .toBuffer();

    const bgCanvas = await sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 4,
        background: { r: bgR, g: bgG, b: bgB, alpha: 1 }
      }
    }).png().toBuffer();

    return sharp(bgCanvas)
      .composite([{
        input: innerBuffer,
        top: Math.round((targetSize - innerSize) / 2),
        left: Math.round((targetSize - innerSize) / 2)
      }])
      .png({ compressionLevel: 9 });
  };

  console.log('Generating icon-maskable-512.png...');
  await (await makeMaskable(512)).toFile(path.join(outDir, 'icon-maskable-512.png'));

  console.log('Generating icon-maskable-192.png...');
  await (await makeMaskable(192)).toFile(path.join(outDir, 'icon-maskable-192.png'));

  // 3. Small icons: 32x32, 16x16, 48x48
  console.log('Generating favicon-32.png...');
  const f32 = await sharp(cleanBase)
    .resize(32, 32, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(outDir, 'favicon-32.png'), f32);
  fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), f32);

  console.log('Generating favicon-16.png...');
  const f16 = await sharp(cleanBase)
    .resize(16, 16, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(outDir, 'favicon-16.png'), f16);
  fs.writeFileSync(path.join(publicDir, 'favicon-16.png'), f16);

  console.log('Generating favicon.png (48x48)...');
  const f48 = await sharp(cleanBase)
    .resize(48, 48, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), f48);

  // 4. Update favicon.svg with embedded high-def 128x128 puppy racer and squircle clip
  console.log('Generating favicon.svg...');
  const f128Base64 = (await sharp(cleanBase)
    .resize(128, 128, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer()
  ).toString('base64');

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <clipPath id="sq">
      <rect width="128" height="128" rx="36" ry="36" />
    </clipPath>
  </defs>
  <rect width="128" height="128" rx="36" ry="36" fill="#0b3129"/>
  <image href="data:image/png;base64,${f128Base64}" width="128" height="128" clip-path="url(#sq)" />
</svg>
`;
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent, 'utf8');

  console.log('All icons generated and synced successfully!');
}

run().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
