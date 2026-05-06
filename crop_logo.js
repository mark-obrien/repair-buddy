const sharp = require('sharp');
const fs = require('fs');

const inputPath = 'C:\\Users\\Mark\\.gemini\\antigravity\\brain\\a38eaed6-949d-4e17-95d6-0bebe2138b0e\\media__1778078923341.jpg';
const outputPath = 'public/logo.png';

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

sharp(inputPath)
  .trim({
    background: '#ffffff',
    threshold: 10
  })
  .toFile(outputPath)
  .then(info => {
    console.log('Image cropped successfully:', info);
  })
  .catch(err => {
    console.error('Error cropping image:', err);
    process.exit(1);
  });
