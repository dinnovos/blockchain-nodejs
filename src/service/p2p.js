import  webSocket from 'ws';

const { P2P_PORT = 5000, PEERS } = process.env;
const peers = PEERS ? PEERS.split(",") : [];
const MESSAGE = { 
	BLOCKS: 'blocks',
	TX: 'transaction'
};

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

		// Por cad peer intento establecer una conexion
		peers.forEach((peer) => {
			const socket = new webSocket(peer);

			// Por cada peer llamo a onConneciton para guardar en la instancia ese socket
			socket.on("open", () => this.onConnection(socket));
		});

		console.log(`Service WS: ${P2P_PORT} listening...`);
	}

	onConnection(socket){
		const { blockchain } = this;

		console.log('[ws:socket connect]');

		// Se almacena el nuevo socket en un array para enviar mensajes a futuro (Broadcast).
		this.sockets.push(socket);

		// Cuando recibo el mensaje, obtengo una lista de bloque del nodo al que me he contacto
		// Luego intento reemplazar esa lista de bloque por la lista de la instancia actual
		socket.on("message", (message) => {
			const { type, value } = JSON.parse(message);

			try{
				if(type === MESSAGE.BLOCKS)
					blockchain.replace(value);
				else if(type === MESSAGE.TX)
					blockchain.memoryPool.addOrUpdate(value);
			}catch(error){
				console.log(`[ws:message] error ${error}`);
				throw Error(error);
			}
		});

		// Cuando se establece una conexion se envia a ese nodo los bloques que tiene la instancia actual
		socket.send(JSON.stringify({ type: MESSAGE.BLOCKS, value:blockchain.blocks }));
	}

	sync(){
		const {blockchain: { blocks } } = this;

		// Envio un mensaje a todos los nodos de la red con los bloques de la instancia actual
		this.broadcast(MESSAGE.BLOCKS, blocks);
	}

	broadcast(type, value){
		console.log(`[ws:broadcast] ${type}...`);
		const message = JSON.stringify({type, value});

		this.sockets.forEach((socket) => socket.send(message));
	}
}


export  { MESSAGE };
export default P2PService;