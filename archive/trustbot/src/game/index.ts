/**
 * Game Entry Point
 * 
 * Starts the interactive terminal game.
 */

import { GameUI } from './GameUI.js';

const game = new GameUI();
game.start().catch(console.error);
