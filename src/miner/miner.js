import { Transaction } from '../wallet';
import { MESSAGE } from '../service/p2p';

class Miner{
	constructor(blockchain, p2pService, wallet){
		this.blockchain = blockchain;
		this.p2pService = p2pService;
		this.wallet = wallet;
	}

	mine(blockchainWallet){
		const { blockchain: { memoryPool }, p2pService, wallet } = this;

		if(memoryPool.transactions.length === 0)
			throw Error('There are no unconfirmed transaction');

		// Incluye la recompensa por minar la transaccion
		memoryPool.transactions.push(Transaction.reward(wallet, blockchainWallet));

		// Crea el block con la transaccion valida
		const block = this.blockchain.addBlock(memoryPool.transactions);

		// Sincroniza la nueva blockchain con toda la red
		p2pService.sync();

		// Limpia todas las transacciones de memory pool
		memoryPool.wipe();

		// Envia mensaje broadcast
		p2pService.broadcast(MESSAGE.WIPE);

		return block;
	}
}

export default Miner;