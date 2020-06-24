import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import ejs from 'ejs';

import Blockchain from '../blockchain';
import P2PService, { MESSAGE } from './p2p';
import Wallet, { TYPE } from '../wallet';
import Miner from '../miner';

const HTTPS = require('https');

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

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
    next();
});

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

	const newWallet = new Wallet(blockchain, 1000);
	const { publicKey, keyPair } = newWallet;

	walletContainer.push(newWallet);
	res.json({ publicKey: publicKey, keyPair: keyPair });
});

app.get("/wallet/balance", (req, res) => {

	const { query: { publicKey } } = req;

	let data = {};

	walletContainer.forEach((wallet) => {
		if(wallet.publicKey === publicKey){
			data = { balance: wallet.currentBalance };
		}
	});

	if(Object.keys(data).length === 0){
		res.json({"status":"failed", "message":"wallet not found"});

		return;
	}

	res.json(data);
});

app.get("/wallet/unconfirmed/transactions", (req, res) => {
	const { query: { publicKey } } = req;
	const { memoryPool } = blockchain;

	let tx = memoryPool.find(publicKey);

	res.json({"status":"ok", "tx":tx});
});

app.get("/wallet/confirmed/transactions", (req, res) => {
	const { query: { publicKey } } = req;
	const { blocks } = blockchain;

	let txs = [];

	const blocksTx = blocks.filter(( block ) => Array.isArray(block.data) );

	blocksTx.forEach((block) => {

		block.data.forEach((tx) => {
			if(tx.input.address === publicKey){
				txs.push(tx);
			}
		});

	});

	res.json({"status":"ok", "txs":txs});
});


app.post("/miner-wallet", (req, res) => {

	const { body: { key } } = req;

	let data = {};

	if(key === undefined || key === null || key === ""){
		res.json({status:"failed", "message": "Not key found"});
		return;
	}
	
	walletContainer.forEach((wallet) => {
		if(wallet.key === key){
			data = { publicKey: wallet.publicKey, keyPair: wallet.keyPair, balance: wallet.balance };
		}
	});

	if(Object.keys(data).length === 0){
		const newWallet = new Wallet(blockchain, 0, TYPE.MINER, key);
		const { publicKey, keyPair, balance } = newWallet;
		walletContainer.push(newWallet);
		data = { publicKey: publicKey, keyPair: keyPair, balance: balance };
	}

	res.json(data);
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

//SSL certificate
let privateKey = fs.readFileSync(path.resolve('./private.key'), 'utf8');
let certificate = fs.readFileSync(path.resolve('./certificate.crt'), 'utf8');
let credentials = { key: privateKey, cert: certificate };

var httpsServer = HTTPS.createServer(credentials, app);

// Inicia server https
httpsServer.listen(443);