/* eslint-disable no-unused-vars */
import { MinaBlockchain } from "./blockchain.js";
import { ZKDatabase } from "./database.js";
import { GlobalContext } from "./global-context.js";

export interface ZKDatabaseContext {
  database(name: string): ZKDatabase;
  minaBlockchain(): MinaBlockchain;
  global(): GlobalContext
}