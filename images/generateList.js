const fs = require('fs');
const path = require('path');

const imagesDir = __dirname;
const outputPath = path.join(imagesDir, 'images.json');
const rootDir = path.resolve(imagesDir, '..');
const allowedExtensions = /\.(jpe?g|png|gif|webp)$/i;

function ensureDefaultImage() {
  const fallbackSource = path.join(rootDir, 'ArtGallery.png');
  const fallbackTarget = path.join(imagesDir, 'ArtGallery.png');

  if (fs.existsSync(fallbackSource) && !fs.existsSync(fallbackTarget)) {
    fs.copyFileSync(fallbackSource, fallbackTarget);
  }
}

function listImages() {
  const fileNames = fs
    .readdirSync(imagesDir)
    .filter((name) => {
      if (name === 'images.json' || name === 'generateList.js') return false;
      return allowedExtensions.test(name);
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (fileNames.length === 0) {
    ensureDefaultImage();
    const fallbackName = 'ArtGallery.png';
    if (fs.existsSync(path.join(imagesDir, fallbackName))) {
      return [fallbackName];
    }
  }

  return fileNames;
}

const images = listImages().map((file, index) => ({
  file,
  title: path.basename(file, path.extname(file)),
  date: 'local',
  placeOfOrigin: 'local',
  source: 'local',
  width: 1,
  height: 1,
  image_id: index
}));

fs.writeFileSync(outputPath, JSON.stringify({ images }, null, 2));
console.log(`Generated ${images.length} local image entries in ${outputPath}`);
