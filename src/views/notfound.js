import { setAccent } from '../core/accent.js';
import { mountGame } from './nf-game.js';

/** 404: static markup, a neutral accent and a small hidden game (nf-game.js). */
export function mountNotFound() {
    document.title = 'Página no encontrada | Máximo Mazzuchin';
    setAccent(null);
    const canvas = document.querySelector('.nf-game');
    return canvas ? mountGame(canvas) : () => {};
}
