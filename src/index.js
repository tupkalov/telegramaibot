const Bot = require('./Bot')
const Config = require('./Config');
const fs = require('fs');
const yaml = require('js-yaml');
const { configs } = yaml.load(fs.readFileSync(__dirname + '/../config.yaml', 'utf8'));

const HCServer = require('./HCServer');

global.__appdir = require('path').resolve(__dirname, "../");
global.LOGGER = new (require('./Logger'));
LOGGER.log("Starting...")
LOGGER.log(`Loaded ${configs.length} configs`)
LOGGER.log("Starting bots...")

const botInstances = []
// Start all bots
for (let configIndex in configs) {
	let config = configs[configIndex];
	LOGGER.log(`Starting bot "${config?.name}"...`)

	// Load config
	try {
		config = new Config(config);
	} catch (error) {
		LOGGER.error(error.message);
		continue;
	}

	// Skip disabled bots
	if (config.enabled === false) {
		LOGGER.log(`Bot "${config.name}" is disabled`)
		continue;
	}

	// Start bot
	const bot = new Bot({ config });
	botInstances.push(bot.telegramBot);
	
	LOGGER.log(`Bot "${config.name}" started`)
}

HCServer.listenTo(botInstances)