const defaults = {
    maxTokenSize: 4000,
    messages: {
        wrongTypeOfMessage: "I understand only text messages",
        resetMessage: "Conversation has been reset",
        defaultHello: "?",
        wrongUserIdMessage: "Who are you?"
    }
}

// Load config.yaml and check required parameters
module.exports = class Config {
    constructor(data) {
        if (!data) throw new Error("Config is empty!")

        // Проверяем обязательные параметры
        for (const configParamName of [
            "name",
            "openaiApiKey",
            "openaiModel",
            "openaiOrg",
            "telegramToken",
            "context"
        ]) {
            if (!data[configParamName]) throw new Error(`config.${configParamName} in "${data.name}" is not defined!`);
        }

        Object.assign(this, defaults, data);

        this.messages = Object.assign({}, defaults.messages, this.messages);
    }
}
  