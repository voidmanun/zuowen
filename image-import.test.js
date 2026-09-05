const assert = require('node:assert');
const { imageDataUrl, parsedMaterials } = require('./server.js');

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100)]).toString('base64');
assert.equal(imageDataUrl('data:image/jpeg;base64,' + jpeg).startsWith('data:image/jpeg'), true);
assert.throws(() => imageDataUrl('data:text/plain;base64,' + jpeg));

const materials = parsedMaterials(JSON.stringify({ materials: [
  { text: '雨停了，公园像刚洗过脸。', chunks: ['雨停了，', '公园像刚洗过脸。'] },
  { text: '太短' },
  { text: '雨停了，公园像刚洗过脸。' }
] }));
assert.deepEqual(materials, [{ text: '雨停了，公园像刚洗过脸。', chunks: ['雨停了，', '公园像刚洗过脸。'] }]);
console.log('图片素材校验通过');
