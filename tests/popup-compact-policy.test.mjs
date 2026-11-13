import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const source=readFileSync('src/components/Pages/PageView.ts','utf8');
const ast=ts.createSourceFile('PageView.ts',source,ts.ScriptTarget.Latest,true);
const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='Compactify');
const js=ts.transpileModule(fn.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
test('a narrow popup never receives the full-page 3rem compact classification',()=>{
 const classes=new Set(['CompactifyEnabledCompactMode']);let enabled=0;
 const page={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}};
 const ctx=vm.createContext({PageContainer:page,Fullscreen:{IsOpen:true},IsPIP:true,isSizeReadyToBeCompacted:()=>true,EnableCompactMode:()=>enabled++,DisableCompactMode(){}});
 vm.runInContext(js+';Compactify();',ctx);assert.equal(classes.has('CompactifyEnabledCompactMode'),false);assert.equal(enabled,1);
 ctx.IsPIP=false;vm.runInContext('Compactify();',ctx);assert.equal(classes.has('CompactifyEnabledCompactMode'),true);
});
