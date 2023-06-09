const Bot = require('./Bot')

global.BOT = new Bot({
	configFile: __dirname + '/../config.yaml',
	stackFile: __dirname + '/../data/chat.json'
});

global.BOT.start();