import {
  getZkDbSmartContractClass,
  ProofStateInput,
  ProofStateOutput,
} from '@zkdb/smart-contract';
import {
  ModelDbSetting,
  ModelMerkleTree,
  ModelNetwork,
  ModelProof,
  ModelQueueTask,
  withTransaction,
} from '@zkdb/storage';
import { ObjectId } from 'mongodb';
import {
  fetchAccount,
  Field,
  MerkleWitness,
  Mina,
  NetworkId,
  PublicKey,
  ZkProgram,
} from 'o1js';
import CircuitFactory from '../circuit/circuit-factory.js';
import logger from '../helper/logger.js';

export async function createProof(taskId: string) {
  const queue = ModelQueueTask.getInstance();

  const task = await queue.findOne({ _id: new ObjectId(taskId) });

  if (!task) {
    logger.error('Task has not been found');
    throw Error('Task has not been found');
  }

  if (task.status !== 'proving') {
    logger.error('Task has not been marked as executing');
    throw Error('Task has not been marked as executing');
  }

  try {
    const circuitName = `${task.databaseName}.${task.collectionName}`;
    const modelDbSetting = ModelDbSetting.getInstance();
    const { merkleHeight, appPublicKey, networkId } =
      (await modelDbSetting.getSetting(task.databaseName, task.networkId)) || {};

    if (!merkleHeight || !appPublicKey) {
      throw new Error('Setting is wrong, unable to deconstruct settings');
    }

    const network = await ModelNetwork.getInstance().findOne({
      networkId,
      active: true,
    });

    if (!network) {
      throw Error('No active network found');
    }

    Mina.setActiveInstance(
      Mina.Network({
        networkId: network.networkId as NetworkId,
        mina: network.endpoint,
      })
    );

    const publicKey = PublicKey.fromBase58(appPublicKey);

    const res = await fetchAccount({ publicKey });
    const accountExists = res.error == null;

    if (!accountExists) {
      throw Error(
        `Unable to generate proof because the smart contract ${appPublicKey} for the database does not exist`
      );
    }

    if (!merkleHeight) {
      throw new Error('Merkle Tree height is null');
    }

    const merkleTree = await ModelMerkleTree.load(task.databaseName, task.networkId);

    if (!CircuitFactory.contains(circuitName)) {
      await CircuitFactory.createCircuit(circuitName, merkleHeight);
    }

    const circuit = await CircuitFactory.getCircuit(circuitName).getProgram();
    class RollUpProof extends ZkProgram.Proof(circuit) {}
    class DatabaseMerkleWitness extends MerkleWitness(merkleHeight) {}

    const modelProof = ModelProof.getInstance();
    const zkProof = await modelProof.getProof(task.networkId, task.databaseName);
    let proof = zkProof ? await RollUpProof.fromJSON(zkProof) : undefined;

    const witness = new DatabaseMerkleWitness(
      await merkleTree.getWitness(
        task.merkleIndex,
        new Date(task.createdAt.getTime() - 1)
      )
    );
    const merkleRoot = await merkleTree.getRoot(
      new Date(task.createdAt.getTime() - 1)
    );
    const oldLeaf = await merkleTree.getNode(
      0,
      task.merkleIndex,
      new Date(task.createdAt.getTime() - 1)
    );

    class ZkDbApp extends getZkDbSmartContractClass(merkleHeight, circuit) {}
    const zkDbApp = new ZkDbApp(publicKey);

    const onChainRootState = zkDbApp.currentState.get();
    const prevOnChainRootState = zkDbApp.prevState.get();

    if (proof) {
      const prevProofOutput = proof.publicOutput as ProofStateOutput;

      const proofState = new ProofStateInput({
        currentOnChainState: onChainRootState,
        previousOnChainState: prevOnChainRootState,
        currentOffChainState: merkleRoot,
      });

      if (prevProofOutput.onChainState.equals(onChainRootState).toBoolean()) {
        // basic
        proof = await circuit.update(
          proofState,
          proof,
          witness,
          oldLeaf,
          Field(task.hash)
        );
      } else {
        const rollupProof = await modelProof.findOne({
          merkleRoot: onChainRootState.toString(),
        });
        if (rollupProof) {
          proof = await circuit.updateTransition(
            proofState,
            await RollUpProof.fromJSON(rollupProof),
            proof,
            witness,
            oldLeaf,
            Field(task.hash)
          );
        } else {
          throw Error('RollUp Proof has not been found');
        }
      }
    } else {
      const proofState = new ProofStateInput({
        previousOnChainState: Field(0),
        currentOnChainState: onChainRootState,
        currentOffChainState: merkleRoot,
      });
      proof = await circuit.init(
        proofState,
        witness,
        oldLeaf,
        Field(task.hash)
      );
    }

    // Use proofState here

    // const allActions = await zkDbApp.reducer.fetchActions({
    //   fromActionState: onChainActionState,
    // });

    // if (isEmptyArray(allActions) || isEmptyArray(allActions[0])) {
    //   throw new Error('Unformatted action data');
    // }

    // const [[action]] = allActions;

    // assert(Field(task.hash).equals(action.hash));
    // assert(UInt64.from(task.merkleIndex).equals(action.index));

    // TODO: Should we consider both on-chain action and off-chain leaf. Off-chain leaf = On-chain action

    await withTransaction(async (session) => {
      await modelProof.saveProof(
        {
          ...proof.toJSON(),
          databaseName: task.databaseName,
          collectionName: task.collectionName,
          merkleRoot: proof.publicOutput.newOffChainState.toString(),
          networkId: task.networkId
        },
        { session }
      );
      await queue.markTaskProcessed(task._id, { session });
    });

    logger.debug('Task processed successfully.');
  } catch (error) {
    await queue.markTaskAsError(task._id, error as string);
    logger.error('Error processing task:', error);
  }
}
