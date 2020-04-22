import { Transaction } from '../wallet';

class MemoryPool{
	constructor(){
		this.transactions = [];	
	}

	addOrUpdate(transactions){
		const { input, outputs = [] } = transactions;

		// Suma todos los totales de los outputs
		const outputTotal = outputs.reduce((total, output) => total + output.amount, 0);

		if(input.amount !== outputTotal)
			throw Error(`Invalid transactions from ${input.address}`);

		if(! Transaction.verify(transactions))
			throw Error (`Invalid signature from ${input.address}`);

		const txIndex = this.transactions.findIndex(({ id }) => id === transactions.id );

		if(txIndex >= 0)
			this.transactions[txIndex] = transactions;
		else
			this.transactions.push(transactions);
	}

	find(address){
		return this.transactions.find(({ input }) => input.address === address);
	}
}

export default MemoryPool;