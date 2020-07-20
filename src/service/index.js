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

const { NAME, HTTP_PORT = 3000, HTTPS_PORT = 3440, P2P_PORT = 5000, PRIVKEY, CERT, CHAIN, PEERS } = config;

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

	res.render('index', {walletContainer: walletContainer, transactions: transactions, blocksOfBlockchain: blocksOfBlockchain, typeWallet: TYPE, serverName: NAME});

});

// Get Blocks
app.get("/blocks", (req, res) => {
	res.json(blockchain.blocks);
});

// Wallet Create
app.post("/wallet/create", (req, res) => {

	const newWallet = new Wallet(blockchain, 1000);
	const { publicKey, keyPair } = newWallet;

	walletContainer.push(newWallet);
	res.json({ publicKey: publicKey, keyPair: keyPair });
});

// Create wallet for miner
app.post("/wallet/create/miner", (req, res) => {

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

// Get Balance
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

// Create transaction
app.post("/transaction/create", (req, res) => {
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
});

// Get unconfirmed transactions
app.get("/transactions/unconfirmed", (req, res) => {
	const { query: { publicKey } } = req;
	const { memoryPool } = blockchain;

	let txs = {};

	if(publicKey === undefined){
		txs = memoryPool.getAll();
	}else{
		txs = memoryPool.find(publicKey);
	}

	res.json({"status":"ok", "txs":txs});
});

// Get confirmed transactions
app.get("/transactions/sent", (req, res) => {
	const { query: { publicKey } } = req;
	const { blocks } = blockchain;

	let txs = [];
	let sentTxs = [];

	const blocksTx = blocks.filter(( block ) => Array.isArray(block.data) );

	blocksTx.forEach((block) => {
		block.data.forEach((tx) => {
			if(tx.input.address === publicKey){
				txs.push(tx);
			}
		});
	});

	if(txs.length > 0){
		// Ordena las transacciones
		txs = txs.sort((a, b) => a.input.timestamp - b.input.timestamp);

		txs.forEach((tx) => {

			tx.outputs.forEach((output) => {
				if(output.address !== publicKey){
					sentTxs.push({
						'id': tx.id,
						'amount': output.amount,
						'destinyAddress': output.address,
						'timestamp': output.timestamp
					});
				}
			});
		});
	}

	res.json({"status":"ok", "txs":sentTxs});
});

app.get("/transactions/received", (req, res) => {
	const { query: { publicKey } } = req;
	const { blocks } = blockchain;

	let txs = [];
	let receivedTxs = [];

	const blocksTx = blocks.filter(( block ) => Array.isArray(block.data) );

	blocksTx.forEach((block) => {
		block.data.forEach((tx) => {
			txs.push(tx);
		});
	});

	if(txs.length > 0){
		// Ordena las transacciones
		txs = txs.sort((a, b) => a.input.timestamp - b.input.timestamp);

		txs.forEach((tx) => {

			tx.outputs.forEach((output) => {
				if(output.address === publicKey && output.address !== tx.input.address){
					receivedTxs.push({
						'id': tx.id,
						'amount': output.amount,
						'originAddress': publicKey,
						'timestamp': output.timestamp
					});
				}
			});
		});
	}

	res.json({"status":"ok", "txs":receivedTxs});
});

// Confirm transactions
app.get("/transactions/confirm", (req, res) => {
	try{
		const block = miner.mine(blockchainWallet);
	}catch(error){
		res.json({ error: error.message });
	}

	res.json({ status: "ok" });
});

app.listen(HTTP_PORT, () => {
  	console.log(`Server: ${NAME}`);
  	console.log(`Service HTTP: ${HTTP_PORT} listening...`);
  	p2pService.listen();
})

//SSL certificate
const privateKey = fs.readFileSync(PRIVKEY, 'utf8');
const certificate = fs.readFileSync(CERT, 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate
};

var httpsServer = HTTPS.createServer(credentials, app);

// Inicia server https
httpsServer.listen(HTTPS_PORT, () => {
  	console.log(`Service HTTPS: ${HTTPS_PORT} listening...`);
});