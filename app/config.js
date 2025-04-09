const fs = require('fs');

let config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

function getConfig() {
  return config;
}

function watchConfig(onUpdate) {
  fs.watchFile('config.json', () => {
    try {
      const newConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
      config = newConfig;
      console.log('🔄 config.json recarregado com sucesso!');
      if (onUpdate) onUpdate(config);
    } catch (err) {
      console.error('❌ Erro ao recarregar config.json:', err);
    }
  });
}

module.exports = { getConfig, watchConfig };