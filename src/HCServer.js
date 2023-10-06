const http = require('http');

module.exports = {
    listenTo (botInstances) {
        for (const botInstance of botInstances) {
            botInstance._pollingError = 0;
            botInstance.on('polling_error', () => {
                botInstance._pollingError = Date.now();
            });
        }


        const requestHandler = (req, res) => {
            if (req.url === '/health' && req.method === 'GET') {
                const promises = botInstances.map(botInstance => {
                    // Здесь мы проверяем состояние бота
                    return botInstance.getMe().then(() => {
                        // Если последним была ошибка а не удачная загрузка обновлений
                        if (botInstance._polling._lastUpdate < botInstance._pollingError) {
                            throw new Error('Bot is not running');
                        }
                    })
                });

                Promise.all(promises)
                    .then(() => {
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.end('ok');
                    })
                    .catch((e) => {
                        console.error('Error in health check', e)
                        res.writeHead(500, {'Content-Type': 'application/json'});
                        res.end('error');
                    });
            } else {
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end('Not Found');
            }
        };

        const hcserver = http.createServer(requestHandler);

        hcserver.listen(3003, () => {
            console.log(`hc server running on http://localhost:3003/`);
        });
    }
}