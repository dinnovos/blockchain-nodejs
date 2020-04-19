const MINE_REATE = 3000;

export default (previousBlock, timestamp) => {
	const { difficulty } = previousBlock;

	return previousBlock.timestamp + MINE_REATE > timestamp ? difficulty + 1 : difficulty - 1;
}