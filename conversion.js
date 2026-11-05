// Local reverse index. Homophones are offered as candidates, never silently selected.
const reverseWords=new Map();
const reverseKey=value=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,"");
function addReverseWord(word,py){const key=reverseKey(py);if(!reverseWords.has(key))reverseWords.set(key,[]);if(!reverseWords.get(key).includes(word))reverseWords.get(key).push(word)}
(globalThis.PINYIN_REVERSE_WORDS||[]).forEach(([word,py])=>addReverseWord(word,py));
"朋友 学习 语文 拼音 生字 今天 明天 中国 学校 老师 同学 爸爸 妈妈 哥哥 姐姐 妹妹 弟弟 喜欢 快乐 漂亮 知道 什么 怎么 因为 所以 时候 地方 名字 苹果 香蕉 西瓜 太阳 月亮 星星 花朵 森林 动物 老虎 大象 兔子 蝴蝶 蜻蜓 葡萄 春天 夏天 秋天 冬天 早上 晚上 再见 谢谢 你好 中国人 北京 上海 广州 重庆 立马 一二三".split(" ").forEach(word=>addReverseWord(word,pinyinPro.pinyin(word)));
let reverseCharsReady=false;
function findReverseWords(value){if(!reverseCharsReady){for(let n=0x4e00;n<=0x9fff;n++){const ch=String.fromCharCode(n),py=pinyinPro.pinyin(ch);if(py!==ch)addReverseWord(ch,py)}reverseCharsReady=true}return reverseWords.get(reverseKey(value))||[]}

const PINYIN_TONE_MARKS={ā:["a",1],á:["a",2],ǎ:["a",3],à:["a",4],ē:["e",1],é:["e",2],ě:["e",3],è:["e",4],ī:["i",1],í:["i",2],ǐ:["i",3],ì:["i",4],ō:["o",1],ó:["o",2],ǒ:["o",3],ò:["o",4],ū:["u",1],ú:["u",2],ǔ:["u",3],ù:["u",4],ǖ:["ü",1],ǘ:["ü",2],ǚ:["ü",3],ǜ:["ü",4],ḿ:["m",2],ń:["n",2],ň:["n",3],ǹ:["n",4]};
function parsePinyinTone(value){let tone=5,base="";for(const char of value){const mark=PINYIN_TONE_MARKS[char];if(mark){base+=mark[0];tone=mark[1]}else base+=char}return {base,tone}}
function applyPinyinTone(value,tone){const {base}=parsePinyinTone(value);if(tone===5)return base;const lower=base.toLowerCase(),priority=lower.indexOf("a")>=0?lower.indexOf("a"):lower.indexOf("e")>=0?lower.indexOf("e"):lower.indexOf("o")>=0?lower.indexOf("o"):(()=>{for(let i=lower.length-1;i>=0;i--)if("iuü".includes(lower[i]))return i;return -1})();if(priority<0)return base;const vowel=lower[priority],marks={a:"āáǎà",e:"ēéěè",i:"īíǐì",o:"ōóǒò",u:"ūúǔù",ü:"ǖǘǚǜ"};return base.slice(0,priority)+marks[vowel][tone-1]+base.slice(priority+1)}
function pinyinToneChoices(value){const {base,tone}=parsePinyinTone(value);return [1,2,3,4,5].map(number=>({tone:number,value:applyPinyinTone(base,number),selected:number===tone}))}
