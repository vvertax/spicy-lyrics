import cyrillicToLatin from "cyrillic-romanization";
const word=(Text:string,StartTime:number,EndTime:number,IsPartOfWord=false)=>({Text,StartTime,EndTime,IsPartOfWord});
const line=(text:string,start:number,end:number,opposite=false)=>({Lead:{StartTime:start,EndTime:end,Syllables:text.split(' ').map((s,i,a)=>word(s,start+(end-start)*i/a.length,start+(end-start)*(i+1)/a.length))},OppositeAligned:opposite});
export const tracks=[
 {id:'previewA',title:'Свет между строк',artist:'Spicy Lyrics Demo',album:'Your music, in words',duration:55000,cover:'./cover-a.svg',color:'#705097'},
 {id:'previewB',title:'Навстречу утру',artist:'Spicy Lyrics Demo',album:'Your music, in words',duration:45000,cover:'./cover-b.svg',color:'#327e9a'},
];
export function fixture(id:string){const content=id==='previewB'?[line('Мы оставим за окном огни',0,6),line('Чтобы встретить новый день',7,13,true),line('Музыка звучит внутри',14,21),line('И уходит наша тень',22,29,true),line('Слово за словом — навстречу утру',34,43)]:[
 line('Этот город засыпает под дождём',0,6),
 {Lead:{StartTime:7,EndTime:14,Syllables:[word('Мы',7,8),word('собираем',8,9.5),word('от',9.5,10.5,true),word('ра',10.5,11.5,true),word('женья',11.5,13),word('вдвоём',13,14)]},Background:[{StartTime:10,EndTime:15,Syllables:[word('вдвоём',10,15)]}]},
 line('И пускай меняются цвета',16,22,true),line('Нас ведёт знакомая строка',23,29),line('Тихо светятся слова',40,46),line('Музыка останется с нами',47,54,true),
 ];for(const line of content){for(const group of [line.Lead,...('Background' in line?(line.Background??[]):[])]){for(const part of group.Syllables){(part as any).TransliteratedText=cyrillicToLatin(part.Text);}}}return {Type:'Syllable',Content:content,id,uri:'spotify:track:'+id,sourceDisplayName:'Spicy Lyrics Demo',fetchProvider:'demo',fromCache:false,SongWriters:['Spicy Lyrics Demo'],HasTransliterations:true};}
export const compareA=`<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div><p begin="0s" end="6s"><span begin="0s" end="2s">Этот </span><span begin="2s" end="4s">город </span><span begin="4s" end="6s">засыпает</span><span ttm:role="x-bg" begin="3s" end="7s"><span begin="3s" end="7s">эхо</span></span></p><p begin="7s" end="14s"><span begin="7s" end="10s">от</span><span begin="10s" end="14s">раженья</span></p><p begin="16s" end="22s">Меняются цвета</p></div></body></tt>`;
export const compareB=compareA.replace('город ','вечер ').replace('end="6s"','end="6.05s"').replace('>эхо<','>с нами<').replace('begin="10s"','begin="10.1s"');
