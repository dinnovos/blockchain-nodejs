import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import ejs from 'ejs';

import Blockchain from '../blockchain';
import P2PService, { MESSAGE } from './p2p';
import Wallet, { TYPE } from '../wallet';
import Miner from '../miner';

const fs = require('fs');
let envConfig = fs.readFileSync(process.cwd() + '/env.json');
let config = JSON.parse(envConfig);

const { setIntervalAsync } = require('set-interval-async/dynamic');

const { NAME, HTTP_PORT = 3000, P2P_PORT = 5000, PEERS } = config;

const app = express();

const blockchain = new Blockchain();

const mainWallet = new Wallet(blockchain, 1000);
const minerWallet = new Wallet(blockchain, 0, TYPE.MINER);
const blockchainWallet = new Wallet(blockchain, 1000000, TYPE.BLOCKCHAIN);

const p2pService = new P2PService(P2P_PORT, PEERS, blockchain);
const miner = new Miner(blockchain, p2pService, minerWallet);

let walletContainer = [];

walletContainer.push(mainWallet);
walletContainer.push(minerWallet);
walletContainer.push(blockchainWallet);

// Necesario para el montor de plantilla Ejs
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
	const { memoryPool: { transactions }, blocks } = blockchain;
	const blocksTx = blocks.filter(( block ) => Array.isArray(block.data) );

	let blocksOfBlockchain = [];

	blocksTx.forEach((tx) => {
		blocksOfBlockchain.push({
			timestamp: tx.timestamp,
			hash: tx.hash,
			previousHash: tx.previousHash,
			outputs: tx.data
		});
	});

	res.render('index', {walletContainer: walletContainer, transactions: transactions, blocksOfBlockchain: blocksOfBlockchain, typeWallet: TYPE});

});

app.get("/blocks", (req, res) => {
	res.json(blockchain.blocks);
});

app.post("/mine", (req, res) => {
	const {body: { data }} = req;
	const block = blockchain.addBlock(data);

	// Cuando la instancia mine un nuevo bloque, enviara un broadcast a toda la red para intentar reemplazar la blockchain de cada nodo
	p2pService.sync();

	res.json({
		blocks: blockchain.blocks.length,
		block
	});
});

app.post("/wallet", (req, res) => {
	const newWallet = new Wallet(blockchain, 0);
	const { publicKey } = newWallet;

	walletContainer.push(newWallet);

	res.json({ publicKey });
});

app.get("/transactions", (req, res) => {
	const { memoryPool: { transactions } } = blockchain;
	res.json(transactions);
});

app.post("/transaction", (req, res) => {
	const { body: { senderAddress, recipientAddress, amount } } = req;

	if(senderAddress == recipientAddress){
		res.json({ error: "Sender address and recipient address can't be the same" });
		return;
	}

	const senderWallet = walletContainer.find(({ publicKey }) => publicKey === senderAddress );
	const recipientWallet = walletContainer.find(({ publicKey }) => publicKey === recipientAddress );

	if(senderWallet === undefined){
		res.json({ error: "Sender Wallet not found" });
		return;
	}

	if(recipientWallet === undefined){
		res.json({ error: "Recipient Wallet not found" });
		return;
	}

	try{
		const tx = senderWallet.createTransaction(recipientAddress, parseInt(amount));
		p2pService.broadcast(MESSAGE.TX, tx);
		res.json(tx);
		
	}catch(error){
		res.json({ error: error.message });
	}
})

app.get("/mine/transactions", (req, res) => {
	try{
		const block = miner.mine(blockchainWallet);
	}catch(error){
		res.json({ error: error.message });
	}

	res.json({ status: "ok" });
});

/*
// Cada 20 segundos el minero busca transacciones en  momory pool y mina las transacciones
setIntervalAsync(async () => {
	try{
		const block = miner.mine(blockchainWallet);
		console.log("Mining...");
	}catch(error){
		console.log("Error: ", error.message);
	}
}, 60000);
*/

app.listen(HTTP_PORT, () => {
  	console.log(`Server: ${NAME}`);
  	console.log(`Service HTTP: ${HTTP_PORT} listening...`);
  	p2pService.listen();
})