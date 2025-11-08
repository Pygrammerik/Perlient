const sharp = require('sharp');
const fs = require('fs');

// Читаем SVG
const svg = fs.readFileSync('./icon.svg');

// Создаем PNG из SVG
sharp(svg)
  .resize(512, 512)
  .png()
  .toFile('icon.png')
  .then(() => {
    console.log('Иконка icon.png успешно создана!');
    
    // Также создаем иконки разных размеров для разных платформ
    const sizes = [256, 128, 64, 32, 16];
    const promises = sizes.map(size => {
      return sharp(svg)
        .resize(size, size)
        .png()
        .toFile(`icon-${size}.png`)
        .then(() => console.log(`Иконка icon-${size}.png создана`));
    });
    
    return Promise.all(promises);
  })
  .catch(err => {
    console.error('Ошибка при создании иконки:', err);
    // Если sharp не может обработать SVG напрямую, создадим простую PNG
    createSimpleIcon();
  });

function createSimpleIcon() {
  // Создаем простую PNG иконку программно
  const width = 512;
  const height = 512;
  const canvas = Buffer.alloc(width * height * 4);
  
  // Простой градиент фон
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = Math.floor(102 + (118 - 102) * (x / width));
      const g = Math.floor(126 + (75 - 126) * (x / width));
      const b = Math.floor(234 + (162 - 234) * (x / width));
      
      canvas[index] = r;     // R
      canvas[index + 1] = g; // G
      canvas[index + 2] = b; // B
      canvas[index + 3] = 255; // A
    }
  }
  
  sharp(canvas, {
    raw: {
      width: width,
      height: height,
      channels: 4
    }
  })
  .png()
  .toFile('icon.png')
  .then(() => console.log('Простая иконка icon.png создана!'))
  .catch(err => console.error('Ошибка:', err));
}


