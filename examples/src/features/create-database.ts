import { assert, Mina, PrivateKey, PublicKey } from 'o1js';
import {
  AuroWalletSigner,
  DatabaseSearch,
  NodeSigner,
  QueryBuilder,
  ZKDatabaseClient,
} from 'zkdb';

const isBrowser = false;

const DB_NAME = 'shop';

const SERVER_URL = 'http://0.0.0.0:4000/graphql';

async function run() {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);

  const { key: deployerPrivate } = Local.testAccounts[0];

  const signer = isBrowser
    ? new AuroWalletSigner()
    : new NodeSigner(deployerPrivate);

  const zkdb = ZKDatabaseClient.newInstance(
    SERVER_URL,
    signer,
    new Map(),
    'devnet'
  );

  const zkDbPrivateKey = PrivateKey.random();

  await zkdb.authenticator.signUp('user-name', 'robot@gmail.com');

  await zkdb.authenticator.signIn();

  const tx = await zkdb
    .fromBlockchain()
    .deployZKDatabaseSmartContract(18, zkDbPrivateKey);

  await tx.wait();

  await zkdb
    .fromGlobal()
    .createDatabase(DB_NAME, 18, PublicKey.fromPrivateKey(zkDbPrivateKey));

  const databases = await zkdb.fromGlobal().databases();

  console.log(databases);

  assert(databases[0].databaseName === DB_NAME);

  await zkdb.authenticator.signOut();
}

await run();
