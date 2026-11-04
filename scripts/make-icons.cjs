// Generates the app icons from one spark shape.
const sharp = require('sharp');
const icon = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><path fill="#d7ff3e" d="M256 72c14 112 72 170 184 184-112 14-170 72-184 184-14-112-72-170-184-184 112-14 170-72 184-184Z"/></svg>');
const mask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><path fill="#d7ff3e" d="M256 116c11 88 57 129 140 140-83 11-129 52-140 140-11-88-57-129-140-140 83-11 129-52 140-140Z"/></svg>');
(async () => {
  await sharp(icon).resize(192).png().toFile('public/icons/icon-192.png');
  await sharp(icon).resize(512).png().toFile('public/icons/icon-512.png');
  await sharp(mask).resize(512).png().toFile('public/icons/maskable-512.png');
  await sharp(icon).resize(180).png().toFile('public/icons/apple-touch-icon.png');
  console.log('icons ok');
})();
