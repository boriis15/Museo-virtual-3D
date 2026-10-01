const fs = require('fs');
const path = require('path');

const imagesDir = __dirname;
const outputPath = path.join(imagesDir, 'images.json');
const rootDir = path.resolve(imagesDir, '..');
const allowedExtensions = /\.(jpe?g|png|gif|webp)$/i;
const metadataByFile = {
  'WhatsApp Image 2026-09-30 at 6.14.30 PM.jpeg': {
    title: 'imagen 1',
    description: 'descripcion 1'
  },
  '52.jpeg': {
    title: 'imagen 50',
    description: 'descripcion 50'
  },
  '50.jpeg': {
    title: 'imagen 52',
    description: 'descripcion 52'
  },
  '35 (2).jpeg': {
    title: 'imagen 35',
    description: 'descripcion 35'
  }
};

function metadataFor(file) {
  if (metadataByFile[file]) return metadataByFile[file];

  const fileName = path.basename(file, path.extname(file));
  const imageNumber = Number(fileName);
  if (Number.isInteger(imageNumber) && imageNumber >= 2 && imageNumber <= 87) {
    return {
      title: `imagen ${imageNumber}`,
      description: `descripcion ${imageNumber}`
    };
  }

  return {};
}

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

const images = listImages().map((file, index) => {
  const metadata = metadataFor(file);
  return {
    file,
    title: metadata.title || path.basename(file, path.extname(file)),
    description: metadata.description || '',
    date: 'local',
    placeOfOrigin: 'local',
    source: 'local',
    width: 1,
    height: 1,
    image_id: index
  };
});

fs.writeFileSync(outputPath, JSON.stringify({ images }, null, 2));
console.log(`Generated ${images.length} local image entries in ${outputPath}`);
