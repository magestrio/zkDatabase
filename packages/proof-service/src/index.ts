import { DatabaseEngine } from '@zkdb/storage';
import TaskService from './service/task-service.js';
import logger from './helper/logger.js';
import { config } from './helper/config.js';

(async () => {
  const dbEngine = DatabaseEngine.getInstance(config.MONGODB_URL);
  if (!dbEngine.isConnected()) {
    await dbEngine.connect();
  }

  const taskService = new TaskService();

  await taskService.fetchAndProcessTasks();

  logger.info('Proof service stopped.');
})();
