// Local reverse index. Homophones are offered as candidates, never silently selected.
const reverseWords=new Map();
const reverseKey=value=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,"");
function addReverseWord(word,py){const key=reverseKey(py);if(!reverseWords.has(key))reverseWords.set(key,[]);if(!reverseWords.get(key).includes(word))reverseWords.get(key).push(word)}
(globalThis.PINYIN_REVERSE_WORDS||[]).forEach(([word,py])=>addReverseWord(word,py));
"朋友 学习 语文 拼音 生字 今天 明天 中国 学校 老师 同学 爸爸 妈妈 哥哥 姐姐 妹妹 弟弟 喜欢 快乐 漂亮 知道 什么 怎么 因为 所以 时候 地方 名字 苹果 香蕉 西瓜 太阳 月亮 星星 花朵 森林 动物 老虎 大象 兔子 蝴蝶 蜻蜓 葡萄 春天 夏天 秋天 冬天 早上 晚上 再见 谢谢 你好 中国人 北京 上海 广州 重庆 立马 一二三".split(" ").forEach(word=>addReverseWord(word,pinyinPro.pinyin(word)));
let reverseCharsReady=false;
function findReverseWords(value){if(!reverseCharsReady){for(let n=0x4e00;n<=0x9fff;n++){const ch=String.fromCharCode(n),py=pinyinPro.pinyin(ch);if(py!==ch)addReverseWord(ch,py)}reverseCharsReady=true}return reverseWords.get(reverseKey(value))||[]}
