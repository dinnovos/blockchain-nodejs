import { v4 as uuidv4 } from 'uuid';
import { elliptic } from '../modules';

const REWARD = 1;

class Transaction{
	constructor(){
		this.id = uuidv4();
		this.input = null;
		this.outputs = [];
	}

	// Metodo estatico para generar una transaccion
	static create(senderWallet, recipientAddress, amount){
		const { currentBalance, publicKey } = senderWallet;

		if(amount > currentBalance)
			throw Error(`Amount: ${amount} exceed balance.`);

		const transaction = new Transaction();

		// Se utiliza el operador spread ya que son 2 objectos que entra (Output del destinatoario, y Output de quien envia con el nuevo balance)
		transaction.outputs.push(...[
			// Output de quien recibe
			{ amount, address: recipientAddress, timestamp: Date.now()},

			// Output de quien envia pero con el nuevo balance
			{ amount: currentBalance - amount, address: publicKey, timestamp: Date.now()}
		]);

		transaction.input = Transaction.sign(transaction, senderWallet);

		return transaction;
	}

	static reward(minerWallet, blockchainWallet){

		// Crea una transaccion al minero como recompensa por el trabajo de mineria
		return this.create(blockchainWallet, minerWallet.publicKey, REWARD);
	}

	// Metodo estatico para verificar una transaccion
	static verify(transaction){

		// Del input de la transaccion obtiene la direccion y la firma
		// Tambien obtiene el ouput
		const { input: { address, signature }, outputs } = transaction;

		// Verifica la firma a partir de la direccion, la firma y los outputs
		return elliptic.verifySignature(address, signature, outputs);
	}

	static sign(transaction, senderWallet, updateTimestamp = true){

		// Contiene los detalles del emisor
		// Timestamp: momento de creacion de la transaccion
		// Address: direccion publica del emisor
		// Signature: firma digital que hace unica la transaccion

		return {
			timestamp: 	(updateTimestamp)?Date.now():transaction.input.timestamp,
			amount: 	senderWallet.currentBalance,
			address: 	senderWallet.publicKey,
			signature: 	senderWallet.sign(transaction.outputs),
		};
	}

	update(senderWallet, recipientAddress, amount){

		// Busca el output que corresponda a la direccion de quien envia la transaccion
		const senderOutput = this.outputs.find((ouput) => ouput.address === senderWallet.publicKey);

		// Verifica que el monto que desea actualizar no sean mayor al balance de la wallet que envia
		if(amount > senderOutput.amount)
			throw Error(`Amount: ${amount} exceeds balance`);

		// Actualiza el monto del outuput menos el monto que desea actualizar
		senderOutput.amount -= amount;

		// Agrega el output de quien recibe
		this.outputs.push({
			amount, address: recipientAddress
		});

		// El tercer parametro es false, para evitar que se actualice el timestamp del input.
		// Esto es necesario para poder validar transacciones anteriores y sumas del balance al momento de confirmar.
		// Igualmente cada segmento de transaccion tiene su propio timestamp.
		this.input = Transaction.sign(this, senderWallet, false);

		return this;
	}
}

export { REWARD };
export default Transaction;