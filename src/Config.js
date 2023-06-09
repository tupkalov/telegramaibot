const yaml = require('js-yaml');
const fs = require('fs');

// Load config.yaml and check required parameters
module.exports = class Config {
    constructor(file) {
        const { config } = yaml.load(fs.readFileSync(file, 'utf8'));

        // Проверяем обязательные параметры
        for (const configParamName of [
            "openaiApiKey",
            "openaiModel",
            "openaiOrg",
            "telegramToken",
            "context"
        ]) {
            if (!config[configParamName]) throw new Error(`config.${configParamName} is not defined!`);
        }

        Object.assign(this, config);
    }
}
  