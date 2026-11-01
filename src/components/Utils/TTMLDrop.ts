export function bindTTMLDrop(host:HTMLElement, load:(file:File)=>void) {
  const over=(event:DragEvent)=>{if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();event.stopPropagation();host.classList.add('vv-ttml-drag');event.dataTransfer.dropEffect='copy';};
  const leave=(event:DragEvent)=>{if(!event.relatedTarget||!host.contains(event.relatedTarget as Node))host.classList.remove('vv-ttml-drag');};
  const drop=(event:DragEvent)=>{if(!event.dataTransfer?.types.includes('Files'))return;event.preventDefault();event.stopPropagation();host.classList.remove('vv-ttml-drag');const files=event.dataTransfer.files;if(files.length!==1||!files[0].name.toLowerCase().endsWith('.ttml'))return;load(files[0]);};
  host.addEventListener('dragover',over);host.addEventListener('dragleave',leave);host.addEventListener('drop',drop);
  return()=>{host.classList.remove('vv-ttml-drag');host.removeEventListener('dragover',over);host.removeEventListener('dragleave',leave);host.removeEventListener('drop',drop);};
}
export const comparisonLineSources=new WeakMap<HTMLElement,{data:any;index:number}>();
