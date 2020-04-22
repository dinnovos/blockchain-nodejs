import Elliptic from 'elliptic';
import hash from './hash';

const ec = new Elliptic.ec("secp256k1");

export default {
	createKeyPair: () => ec.genKeyPair(),
	
	verifySignature: (publicKey, signature, data) => {

		// return bool
		return ec.keyFromPublic(publicKey, 'hex').verify(hash(data), signature);
	}
}