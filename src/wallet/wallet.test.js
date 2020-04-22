import Wallet, { INITIAL_BALANCE } from './wallet';

describe('Wallet', () => {
	let wallet;

	beforeEach(() => {
		wallet = new Wallet();
	});  

	it('It is a healthy wallet', () =>{
		expect(wallet.balance).toEqual(INITIAL_BALANCE);
		expect(typeof wallet.keyPair).toEqual('object');
		expect(typeof wallet.publicKey).toEqual('string');
		expect(wallet.publicKey.length).toEqual(130);
	});

	it('use sign()', () => {
		const signature = wallet.sign('h3ll0');
		expect(typeof signature).toEqual('object');
		expect(signature).toEqual(wallet.sign('h3ll0'));
	});
});