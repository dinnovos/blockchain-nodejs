import  webSocket from 'ws';

const { P2P_PORT = 5000, PEERS } = process.env;
const peers = PEERS ? PEERS.split(",") : [];
const MESSAGE = { BLOCKS: 'blocks' };

class P2PService{
	constructor(blockchain){
		this.blockchain = blockchain;
		this.sockets = [];
	}

	listen(){

		// Crea una instancia de webSocket en el puerto por defecto (5000)
		const server = new webSocket.Server({port: P2P_PORT});

		// Cuando se reciba una conexion de un cliente
		server.on('connection', (socket) => this.onConnection(socket));

		peers.forEach((peer) => {
			const socket = new webSocket(peer);

			// Por cada peer llamo a onConneciton para guardar en la instancia ese socket
			socket.on("open", () => this.onConnection(socket));
		});

		console.log(`Service WS: ${P2P_PORT} listening...`);
	}

	onConnection(socket){
		const {blockchain: { blocks } } = this;

		console.log('[ws:socket connect]');

		// Se almacena el nuevo socket en un array
		this.sockets.push(socket);

		socket.on("message", (message) => {
			const { type, value } = JSON.parse(message);

			console.log({type, value});
		});

		socket.send(JSON.stringify({type: MESSAGE.BLOCKS, value:blocks}));
	}

	broadcast(type, value){
		console.log(`[ws:broadcast] ${type}...`);
		const message = JSON.stringify({type, value});

		this.sockets.forEach((socket) => socket.send(message));
	}
}

export default P2PService;