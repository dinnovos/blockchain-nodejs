import MemoryPool from './memoryPool';
import Wallet, { Transaction } from '../wallet';

describe("MemoryPool", () => {
	let memoryPool;
	let wallet;
	let transaction;

	beforeEach(() => {
		memoryPool = new MemoryPool();
		wallet = new Wallet();
		transaction = Transaction.create(wallet, 'r4ndon-4ddr33ss');
		memoryPool.addOrUpdate(transaction);
	});

	it("Has one transaction", () => {
		expect(memoryPool.transaction.length).toEqual(1);
	});

	it("Adds a transaction to the memoryPool", () => {
		const found = memoryPool.transaction.find(({ id }) => id === transaction.id);
		expect(found).toEqual(transaction); 
	});

	it("Updates a transaction in the memoryPool", () => {
		const txOld = JSON.stringify(transaction);
		const txNew = transaction.update(wallet, 'oth3r-4ddr33s', 10);

		memoryPool.addOrUpdate(txNew);

		expect(memoryPool.transaction.length).toEqual(1);

		const found = memoryPool.transaction.find(({ id }) => id === transaction.id);
		expect(JSON.stringify(found)).not.toEqual(txOld);
		expect(txNew).toEqual(found);
	});
});