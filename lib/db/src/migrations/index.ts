// Database migrations export
import { up as upPerformance, down as downPerformance } from './performance-optimization';
import { up as upCommandHistory, down as downCommandHistory } from './command-history-migration';

export { upPerformance, downPerformance, upCommandHistory, downCommandHistory };

export const up = async (db: any) => {
  await upPerformance(db);
  await upCommandHistory(db);
};

export const down = async (db: any) => {
  await downCommandHistory(db);
  await downPerformance(db);
};
