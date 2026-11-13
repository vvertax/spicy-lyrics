import {tracks} from './fixtures.ts';
export const state={announcePrefetch:false,index:0,position:0,playing:false,hidden:false,likes:new Set<string>(),loop:'none',shuffle:'none',volume:.7,anchor:performance.now(),onTrack:()=>{},onPosition:()=>{}};
export const events=new EventTarget();
export const track=()=>tracks[state.index];
export const uri=()=>`spotify:track:${track().id}`;
export function position(){const now=performance.now();if(state.playing&&!state.hidden)state.position=Math.min(track().duration,state.position+now-state.anchor);state.anchor=now;return state.position;}
export function seek(ms:number){state.position=Math.max(0,Math.min(track().duration,ms));state.anchor=performance.now();state.onPosition();events.dispatchEvent(new Event('onprogress'));}
export function toggle(){position();state.playing=!state.playing;events.dispatchEvent(new Event('onplaypause'));}
export function next(delta=1){position();state.index=(state.index+delta+tracks.length)%tracks.length;state.position=0;state.anchor=performance.now();state.onTrack();events.dispatchEvent(new Event('songchange'));events.dispatchEvent(new Event('queue_update'));}
export function unavailable(){window.dispatchEvent(new CustomEvent('preview:notice',{detail:'Это действие доступно в Spotify / Available in Spotify.'}));}
export const storagePrefix='spicy-lyrics-preview:';
