import {elliptic, hash} from '../modules';

// Balance inicial
const INITIAL_BALANCE = 100;

class Wallet{
	constructor(){
		this.balance = INITIAL_BALANCE;

		// Clave privada
		this.keyPair = elliptic.createKeyPair();

		// Clave publica
		this.publicKey = this.keyPair.getPublic().encode("hex");
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
}

export { INITIAL_BALANCE };

export default Wallet;