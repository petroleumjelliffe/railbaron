railbaron.players.color.destinations.city.label
                          .city.index
                          .reigon.label
                          .region.index
                          .payouts
                          
                          
function saveGameState(color,destination) {
    if (!supportsLocalStorage()) { return false; }
    
    localStorage["railbaron.game.in.progress"] = gGameInProgress;
		localStorage["railbaron.players." + color+".destinations.region.label"] = destination.region.label;
		localStorage["railbaron.players." + color+".destinations.region.index"] = destination.region.index;
		localStorage["railbaron.players." + color+".destinations.city.label"] = destination.city.label;
		localStorage["railbaron.players." + color+".destinations.city.index"] = destination.city.index;
		localStorage["railbaron.players." + color+".destinations.payouts"] = destination.payouts;


    localStorage["halma.selectedpiece"] = gSelectedPieceIndex;
    localStorage["halma.selectedpiecehasmoved"] = gSelectedPieceHasMoved;
    localStorage["halma.movecount"] = gMoveCount;
    return true;
}
