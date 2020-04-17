import Block from '../block';

export default (blockchain) => {
  const [genesisBlock, ...blocks] = blockchain;

  // Verifica que el block genesis de la cadena de bloques enviada sea igual al genesis
  if (JSON.stringify(genesisBlock) !== JSON.stringify(Block.genesis)) throw Error('Invalid genesis block.');

  // Recorre el resto de los bloques
  for (let i = 0; i < blocks.length; i++) {

    const {
      previousHash, timestamp, hash, data,
    } = blocks[i];

    const previousBlock = blockchain[i];

    // El hash previo debe ser igual al hash del bloque anterior
    if (previousHash !== previousBlock.hash) throw Error('Invalid previous hash.');

    // El hash del bloque actual se debe generar segun el metodo hash de la clase Block
    if (hash !== Block.hash(timestamp, previousHash, data)) throw Error('Invalid hash.');
  }

  return true;
};