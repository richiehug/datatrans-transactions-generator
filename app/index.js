const { executeFlows } = require('./lib/main');
const { loadConfig } = require('./lib/utils/config');

const { config } = loadConfig();

(async () => {
    do {
        try {
            await executeFlows();
        } catch (error) {
            console.error('Execution failed:', error);
            process.exit(1);
        }
    } while (config.loop);
})();