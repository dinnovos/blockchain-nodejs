const MINE_REATE = 3000;

export default (previousBlock, timestamp) => {
	const { difficulty } = previousBlock;

	const difficultyFinally =  previousBlock.timestamp + MINE_REATE > timestamp ? difficulty + 1 : difficulty - 1;

	if(difficultyFinally < 0){
		return 0;
	}

	return difficultyFinally;
}