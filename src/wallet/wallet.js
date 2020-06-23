import { elliptic, hash } from '../modules';
import Transaction from './transaction'; 

// Balance inicial
const INITIAL_BALANCE = 100;

const TYPE = { 
	MINER: 'miner',
	USER: 'user',
	BLOCKCHAIN: 'blockchain',
};

class Wallet{
	constructor(blockchain, initialBalance = INITIAL_BALANCE, type = TYPE.USER, key = null){

		// Solo se debe usar como balance inicial, no como balance actualizado
		this.balance = initialBalance;

		// Clave privada
		this.keyPair = elliptic.createKeyPair();

		// Clave publica
		this.publicKey = this.keyPair.getPublic().encodeCompressed("hex");

		this.blockchain = blockchain;

		this.type = type;

		this.key = key;
	}

	toString(){
		const { balance, publicKey } = this;

		return ` Wallet - 
			publicKey	: ${publicKey.toString()}
			balance 	: ${balance}
		`
	}

	sign(data) {

		// Genera una firma a partir de un hash de la data enviada como parametro
		return this.keyPair.sign(hash(data));
	}

	createTransaction(recipientAddress, amount){
		const { currentBalance, blockchain: { memoryPool } } = this;

		if(amount > currentBalance)
			throw Error(`Amount: ${amount} exceed current balance: ${currentBalance}`);

		// Busca si mi wallet ya tiene una transaccion en memoryPool
		let tx = memoryPool.find(this.publicKey);

		// si la transaccion existe la actualiza con el nuevo output
		if(tx){
			tx.update(this, recipientAddress, amount);
		}else{
			tx = Transaction.create(this, recipientAddress, amount);

			// Actualiza memoryPool con la nueva transaccion.
			memoryPool.addOrUpdate(tx);
		}

		return tx;
	}

	// Calcula el balance de la wallet con cada ultima transaccion
	get currentBalance(){
		const { blockchain: { blocks = [] }, publicKey } = this;
		const txs = [];

		let { balance } = this;
		let timestamp = 0;

		// Recorre todos los bloques de la blockchain y lee el atributo data
		blocks.forEach(({ data = [] }) => {

			// Verifica que data sea array para excluir el bloque genesis cuyo campo data es un string
			if(Array.isArray(data)){

				// De cada bloque recorre data para guardar todas las transacciones en txs
				data.forEach((tx) => txs.push(tx))
			}
		});

		// Filtra todas las transacciones cuyo input tenga la direccion de la wallet
		const walletInputTxs = txs.filter((tx) => tx.input.address === publicKey);

		if(walletInputTxs.length > 0){

			// Obtiene la ultima transaccion que se ha firmado con la wallet
			const recentInputTx = walletInputTxs.sort((a, b) => a.input.timestamp - b.input.timestamp).pop();

			// Obtiene el monto de esa ultima transaccion (Ultimo balance)
			balance = recentInputTx.outputs.find(({ address }) => address === publicKey).amount;

			// Obtiene el timestamp de esa ultima transaccion
			timestamp = recentInputTx.input.timestamp;
		}

		// Vuelte a recorrer todas las transacciones y las filtra para obtener todas aquellas que fueron posterior
		// obtenenido en la ultima transaccion
		// Luego busca en todos los outputs y suma todos los montos (balances) donde la wallet es la receptora
		txs.filter(({ input }) => input.timestamp > timestamp).forEach(( { outputs } ) => {
			outputs.find(({ address, amount }) => {
				if(address === publicKey)
					balance += amount;
			});
		});

		return balance;
	}
}

export { INITIAL_BALANCE, TYPE };

export default Wallet;