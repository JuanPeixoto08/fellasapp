jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// O mock de ImageLoader do jest-expo usa a assinatura antiga (callback); no RN 0.86 o
// Image.getSize nativo espera uma Promise. Aqui a medida responde direto, 320x240.
const { Image } = require('react-native');
jest.spyOn(Image, 'getSize').mockImplementation((uri, success) => {
  if (typeof success === 'function') success(320, 240);
  else return Promise.resolve({ width: 320, height: 240 });
});

// O Jest não roda import() dinâmico: nos testes os emojis vêm por require (dados reais).
jest.mock('./lib/emojiData', () => ({
  loadRawEmojis: () => Promise.resolve(require('emojibase-data/pt/compact.json')),
}));
