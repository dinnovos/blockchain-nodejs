import Transaction from './transaction';
import Wallet, { TYPE } from './wallet';

const blockchainWallet = new Wallet();

export { Transaction, blockchainWallet, TYPE };
export default Wallet;