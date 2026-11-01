/** Favor coherent chromatic accents over grey/white areas without inventing color. */
export function coverAccent(pixels:ArrayLike<number>):number[] {
  const bins=Array.from({length:36},()=>({weight:0,count:0,rgb:[0,0,0]}));
  const average=[0,0,0];let total=0;let chromatic=0;
  for(let i=0;i+3<pixels.length;i+=4){
    const alpha=pixels[i+3]/255;if(alpha<.1)continue;
    const rgb=[pixels[i],pixels[i+1],pixels[i+2]];total+=alpha;
    rgb.forEach((value,index)=>average[index]+=value*alpha);
    const [r,g,b]=rgb.map(value=>value/255);const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
    if(max<.08||delta<.025||delta/max<.07)continue;
    const saturation=delta/max;
    let hue=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;
    hue=(hue*60+360)%360;
    const bin=bins[Math.floor(hue/10)];const weight=Math.sqrt(saturation)*Math.sqrt(max)*alpha;
    bin.weight+=weight;bin.count+=alpha;chromatic+=alpha;
    rgb.forEach((value,index)=>bin.rgb[index]+=value*weight);
  }
  if(!total)return [56,32,82];
  if(chromatic<Math.max(3,total*.02))return average.map(value=>Math.round(value/total));
  const clusters=bins.map((_,i)=>[bins[(i+35)%36],bins[i],bins[(i+1)%36]]);
  const best=clusters.reduce((a,b)=>b.reduce((s,v)=>s+v.weight,0)>a.reduce((s,v)=>s+v.weight,0)?b:a);
  const weight=best.reduce((sum,bin)=>sum+bin.weight,0);
  return [0,1,2].map(channel=>Math.round(best.reduce((sum,bin)=>sum+bin.rgb[channel],0)/weight));
}

/** Two distinct anchors: the cover's chromatic accent and its overall dark base. */
export function coverGradient(pixels:ArrayLike<number>){
  let accent=coverAccent(pixels);
  const max=Math.max(...accent),min=Math.min(...accent);
  if(max-min>=20&&max<140)accent=accent.map(value=>Math.round(value*Math.min(3,140/Math.max(1,max))));
  const average=[0,0,0];let total=0;
  for(let i=0;i+3<pixels.length;i+=4){const alpha=pixels[i+3]/255;if(alpha<.1)continue;total+=alpha;for(let j=0;j<3;j++)average[j]+=pixels[i+j]*alpha;}
  const base=average.map(value=>total?value/total:0);
  // Remove neutral contamination from the accent; keep bright covers chromatic
  // at both ends, while genuinely dark artwork can still fade into near-black.
  const neutral=Math.min(...accent)*.6;
  const chroma=accent.map(value=>Math.max(0,value-neutral));
  const colorShare=Math.max(0,Math.min(1,(Math.max(...base)-30)/90));
  const top=chroma.map(value=>Math.round(value*.48+6));
  const bottom=base.map((value,index)=>Math.round((value*.16)*(1-colorShare)+(chroma[index]*.32)*colorShare+5));
  return {accent,background:[top,bottom]};
}
