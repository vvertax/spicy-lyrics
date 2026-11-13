export function previewStorage(native:Storage,prefix:string):Storage {
 const keys=()=>Array.from({length:native.length},(_,i)=>native.key(i)).filter((k):k is string=>!!k&&k.startsWith(prefix));
 return {getItem:key=>native.getItem(prefix+key),setItem:(key,value)=>native.setItem(prefix+key,String(value)),removeItem:key=>native.removeItem(prefix+key),clear:()=>keys().forEach(key=>native.removeItem(key)),key:index=>keys()[index]?.slice(prefix.length)??null,get length(){return keys().length;}};
}
