/* eslint-disable @typescript-eslint/no-require-imports */
// Native Git command regression only; no index, credentials, database or release action.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const options=['-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol','-c','core.safecrlf=false','diff','--no-index','--check','--','/dev/null'];
function withTextFiles(run){
    const base=path.resolve('test-results');fs.mkdirSync(base,{recursive:true});
    const dir=fs.mkdtempSync(path.join(base,'preview-whitespace-'));
    try{run(dir);}finally{
        // Only this test's flat generated files; no recursive cleanup or repository changes.
        for(const name of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,name));
        fs.rmdirSync(dir);
    }
}
function check(file){
    const result=cp.spawnSync('git',[...options,file],{encoding:'utf8',windowsHide:true});
    assert.ifError(result.error);
    return result;
}
test('native new-file check accepts a single final LF, CRLF and empty file without staging',()=>withTextFiles(dir=>{
    for(const[name,text]of [['new file.txt','first\nlast\n'],['crlf.txt','first\r\nlast\r\n'],['empty.txt','']]){
        const file=path.join(dir,name);fs.writeFileSync(file,text,{flag:'wx'});
        const result=check(file);assert.ok([0,1].includes(result.status));assert.equal(result.stdout,'');assert.equal(result.stderr,'');
    }
}));
test('native new-file check rejects extra EOF blanks, trailing whitespace and missing paths',()=>withTextFiles(dir=>{
    for(const[name,text,diagnostic]of [['e1p-eof.txt','component();\n\n',/new blank line at EOF/],['crlf-eof.txt','component();\r\n\r\n',/new blank line at EOF/],['trailing.txt','component(); \n',/trailing whitespace/]]){
        const file=path.join(dir,name);fs.writeFileSync(file,text,{flag:'wx'});
        const result=check(file);assert.ok(![0,1].includes(result.status));assert.match(result.stdout,diagnostic);
    }
    const missingPath=path.join(dir,'missing.txt');assert.equal(fs.existsSync(missingPath),false);
    const missing=check(missingPath);
    // --no-index can return 1 for either a clean addition or a path error: diagnostics are mandatory.
    assert.equal([0,1].includes(missing.status)&&!missing.stdout&&!missing.stderr,false);assert.notEqual(missing.stderr,'');
}));
