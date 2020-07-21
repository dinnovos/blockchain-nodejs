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
		let inputAddress = null;
		let previousTxs = [];
		let subAmount = 0;
		let memoryPoolTxs = [];
		let outputs = [];

		if(memoryPool.transactions.length === 0)
			throw Error('There are no unconfirmed transaction');

		console.log(memoryPool.transactions);

		memoryPool.transactions.forEach(( tx ) => {
			inputAddress = tx.input.address;

			subAmount = 0;

			// Obtiene todas las transacciones previas
			previousTxs = memoryPool.transactions.filter(({ input }) => input.timestamp < tx.input.timestamp);

			// Si encuentra transacciones previas
			if(previousTxs.length > 0){

				previousTxs.forEach(( previousTx ) => {

					// En cada output verifica si la direccion es igual a la direccion actual
					previousTx.outputs.find(({ address, amount }) => {
						if(address === inputAddress){

							// Acumula todos los montos
							subAmount += amount;
						}
					});
				});
			}

			// Si existe un monto
			if(subAmount > 0){

				outputs = [];

				// Actualizo el monto del input
				tx.input.amount = tx.input.amount + subAmount;

				// Recorro los outputs de la transaccion actual
				tx.outputs.forEach(( output ) => {

					// Si la direccion output es igual al de la transaccion
					if(output.address === inputAddress){

						// Incremento mi monto mas el monto encontrado
						output.amount = output.amount + subAmount;
					}

					outputs.push(output);
				});

				tx.outputs = outputs;
			}

			memoryPoolTxs.push(tx);
		});

		// Incluye la recompensa por minar la transaccion
		memoryPool.transactions.push(Transaction.reward(wallet, blockchainWallet));

		// Crea el block con la transaccion valida
		const block = this.blockchain.addBlock(memoryPoolTxs);

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