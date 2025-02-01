const { executeFlows } = require('./lib/main');

(async () => {
    try {
        await executeFlows();
    } catch (error) {
        console.error('Execution failed:', error);
        process.exit(1);
    }
})();