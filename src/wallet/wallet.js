import {elliptic, hash} from '../modules';
import Transaction from './transaction'; 

// Balance inicial
const INITIAL_BALANCE = 100;

class Wallet{
	constructor(blockchain){
		this.balance = INITIAL_BALANCE;

		// Clave privada
		this.keyPair = elliptic.createKeyPair();

		// Clave publica
		this.publicKey = this.keyPair.getPublic().encode("hex");

		this.blockchain = blockchain;
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
		const { balance, blockchain: { memoryPool } } = this;

		if(amount > balance)
			throw Error(`Amount: ${amount} exceed current balance: ${balance}`);

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
}

export { INITIAL_BALANCE };

export default Wallet;