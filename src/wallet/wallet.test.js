import Wallet, { INITIAL_BALANCE } from './wallet';
import Blockchain from '../blockchain';

describe('Wallet', () => {
	let blockchain;
	let wallet;

	beforeEach(() => {
		blockchain = new Blockchain();
		wallet = new Wallet(blockchain);
	});  

	it('It is a healthy wallet', () =>{
		expect(wallet.balance).toEqual(INITIAL_BALANCE);
		expect(typeof wallet.keyPair).toEqual('object');
		expect(typeof wallet.publicKey).toEqual('string');
		expect(wallet.publicKey.length).toEqual(66);
	});

	it('use sign()', () => {
		const signature = wallet.sign('h3ll0');
		expect(typeof signature).toEqual('object');
		expect(signature).toEqual(wallet.sign('h3ll0'));
	});

	describe('Creating a transaction', () => {
		let tx;
		let recipientAddress;
		let amount;

		beforeEach(() => {
			recipientAddress = 'r4nd0n-4ddrees';
			amount = 5;
			tx = wallet.createTransaction(recipientAddress, amount);
		});

		describe('And doing the same transaction', () => {
			beforeEach(() => {
				tx = wallet.createTransaction(recipientAddress, amount);
			});

			it('Double the `amount` subtracted from the wallet balance', () => {
				const output = tx.outputs.find(({ address }) => address === wallet.publicKey);
				expect(output.amount).toEqual(wallet.balance - (amount * 2));
			});

			it('Clones the `amount` output for the recipient', () => {
				const amounts = tx.outputs
					.filter(({ address }) => address === recipientAddress)
					.map((output) => output.amount);

				expect(amounts).toEqual([amount, amount]);
			});
    	}); 
	});

	describe('Calculating the current balance', () => {
		let addBalance;
		let times;
		let senderWallet;

		beforeEach(() => {
			addBalance = 10;
			times = 3;
			senderWallet = new Wallet(blockchain);

			for(let i = 0; i < times; i+=1){
				senderWallet.createTransaction(wallet.publicKey, addBalance);
			}

			blockchain.addBlock(blockchain.memoryPool.transactions);
		});

		it('Calculates the balance for blockchain txs matching the recipient', () => {
			expect(wallet.currentBalance).toEqual(INITIAL_BALANCE + (addBalance * times));
		});

		it("Calculates the balance for blockchain exs matching the sender", () => {
			expect(senderWallet.currentBalance).toEqual(INITIAL_BALANCE - (addBalance * times));
		});

		describe("And the recipient conduts a transactions", () => {
			let subtractBalance;
			let walletBalance;
			let senderBalance;

			beforeEach(() => {
				blockchain.memoryPool.wipe();
				subtractBalance = 5;
				walletBalance = wallet.currentBalance;
				senderBalance = senderWallet.currentBalance;

				wallet.createTransaction(senderWallet.publicKey, subtractBalance);
				blockchain.addBlock(blockchain.memoryPool.transactions);
			});

			it("Calculate new balance for wallet and senderWallet", () => {
				expect(wallet.currentBalance).toEqual(walletBalance - subtractBalance);
				expect(senderWallet.currentBalance).toEqual(senderBalance + subtractBalance);
			});

			describe("And the sender sends another transactions to the recipient", () => {
				beforeEach(() => {
					blockchain.memoryPool.wipe();
					senderWallet.createTransaction(wallet.publicKey, subtractBalance);
					blockchain.addBlock(blockchain.memoryPool.transactions);
				})

				it("Calculate the recipient balance only using txs since its most recent one", () => {
					expect(wallet.currentBalance).toEqual(walletBalance);
					expect(senderWallet.currentBalance).toEqual(senderBalance);
				});
			});
			
		});
	});
});