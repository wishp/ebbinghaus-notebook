const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const pinyinPro=require("../vendor/pinyin-pro");

const context={pinyinPro,globalThis:null};
context.globalThis=context;
vm.runInNewContext(fs.readFileSync(require.resolve("../conversion.js"),"utf8"),context);

assert.deepEqual({...context.parsePinyinTone("péng")},{base:"peng",tone:2});
assert.equal(context.applyPinyinTone("peng",1),"pēng");
assert.equal(context.applyPinyinTone("péng",2),"péng");
assert.equal(context.applyPinyinTone("pěng",3),"pěng");
assert.equal(context.applyPinyinTone("pèng",4),"pèng");
assert.equal(context.applyPinyinTone("nǚ",5),"nü");
assert.equal(context.applyPinyinTone("xue",4),"xuè");
assert.deepEqual(Array.from(context.pinyinToneChoices("yǒu"),choice=>choice.value),["yōu","yóu","yǒu","yòu","you"]);
assert.deepEqual(pinyinPro.polyphonic("重",{type:"array"})[0],["zhòng","chóng"]);

console.log("pinyin tone tests passed");
