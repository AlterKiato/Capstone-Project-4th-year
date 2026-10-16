/* eslint-disable @typescript-eslint/no-require-imports */
// Real browser/native dialogs with in-memory synthetic action responses; no DB/provider.
const assert = require('node:assert/strict');
const path = require('node:path');
const {build} = require('esbuild'); // Already installed transitively with tsx; no dependency added.
const {chromium,expect} = require('@playwright/test');
const mock = `
const s=window.__state={canDecide:true,eligible:true,accepted:false,decision:'Pending Verification',revoked:false,revision:0,consentRevision:0,available:true};
window.__calls=[];
export async function getEligibilityUIAction(){return {available:s.available,canDecide:s.canDecide,decision:s.decision,revoked:s.revoked,revision:s.revision};}
export async function getConsentUIAction(){return {available:s.available,eligible:s.eligible,accepted:s.accepted,consentRevision:s.consentRevision,termsVersion:'synthetic-draft-v2',termsText:'DRAFT: Institutional/provider privacy terms require approval. Groq remains disabled. Optional, potentially inaccurate; no grading or official feedback. Proposed pilot limits require approval.'};}
export async function recordAIEligibilityAction(input){window.__calls.push(input);s.decision=input.decision;s.revoked=input.revoke;s.revision++;return {success:true,message:'Synthetic decision recorded'};}
export async function recordAIConsentAction(input){window.__calls.push(input);s.accepted=input.action==='accept';s.consentRevision++;return {success:true,message:'Synthetic consent recorded'};}
export async function createManagedAccountAction(input){window.__calls.push({roleId:input.roleId});return {success:true,message:'Synthetic account created',data:{id:120}};}
`;
async function main(){
 const bundle=await build({write:false,outfile:'governance-ui.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Account from './components/dashboard/admin-account-creation';import {EligibilityDialog,ConsentDialog} from './components/dashboard/ai-governance-dialogs';function App(){const[mode,setMode]=useState(null);return <><button onClick={()=>setMode('create')}>New Account</button>{mode==='create'&&<Account onClose={()=>setMode(null)} onCreated={id=>setMode(id)}/>} {typeof mode==='number'&&<EligibilityDialog userId={mode} initiallyOpen onClose={()=>setMode(null)}/>}<EligibilityDialog userId={20}/><ConsentDialog/></>;}createRoot(document.getElementById('root')).render(<App/>);`},plugins:[{name:'synthetic-actions',setup(b){
 b.onResolve({filter:/^@\/lib\/actions\//},()=>({path:'actions',namespace:'mock'}));
 b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='actions'?mock:'export function useRouter(){return {refresh(){}}}',loader:'js'}));
 b.onResolve({filter:/^@\//},args=>({path:path.resolve(process.cwd(),args.path.replace(/^@\//,''))+'.tsx'}));
 }}]});
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage();const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.name));
  await page.route('**/*',r=>{external.push('external');return r.abort();});
  await page.setContent('<div id="root"></div>');await page.addStyleTag({content:bundle.outputFiles.find(file=>file.path.endsWith('.css')).text});await page.addScriptTag({content:bundle.outputFiles.find(file=>file.path.endsWith('.js')).text});
  const firstUse=page.getByRole('dialog');await expect(firstUse.getByRole('heading',{name:'AI Terms & Consent'})).toBeVisible();await expect(firstUse.getByRole('checkbox')).not.toBeChecked();await firstUse.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'New Account',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Create Account',exact:true});
  await form.getByLabel('First name').fill('Synthetic');await form.getByLabel('Last name').fill('Tester');await form.getByLabel('Email').fill('synthetic@example.invalid');
  await form.getByLabel('Password',{exact:true}).fill('Synthetic-only-password');await form.getByLabel('Confirm password').fill('Synthetic-only-password');
  await form.getByRole('button',{name:'Create account',exact:true}).click();
  let dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Eligibility decision')).toHaveValue('Pending Verification');
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();await expect(dialog.getByRole('button',{name:'Record eligibility'})).toBeDisabled();
  await dialog.getByLabel('Eligibility decision').selectOption('Eligible');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Record eligibility'}).click();
  await expect(dialog.getByText('Current status: Eligible',{exact:true})).toBeVisible();await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Revoke eligibility'}).click();await dialog.getByRole('button',{name:'Confirm revocation',exact:true}).click();await expect(dialog.getByText('Current status: Not Eligible (revoked)',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Close Institutional AI eligibility',exact:true}).click();
  await page.evaluate(()=>window.__state.canDecide=false);await page.getByRole('button',{name:'AI eligibility',exact:true}).last().click();
  await expect(dialog.getByRole('button',{name:'Record eligibility'})).toBeDisabled();await expect(dialog.getByRole('checkbox')).toBeDisabled();await dialog.getByRole('button',{name:'Close Institutional AI eligibility',exact:true}).click();
  await page.getByRole('button',{name:'AI Terms & Consent',exact:true}).click();
  await expect(dialog.getByText(/DRAFT: Institutional/)).toBeVisible();await expect(dialog.getByRole('checkbox')).not.toBeChecked();await expect(dialog.getByRole('button',{name:'Accept terms'})).toBeDisabled();
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Accept terms'}).click();await expect(dialog.getByText('Consent: Accepted current version')).toBeVisible();
  await dialog.getByRole('button',{name:'Withdraw consent'}).click();await expect(dialog.getByText('Consent: Not accepted for current eligibility and terms')).toBeVisible();
  await dialog.getByRole('button',{name:'Decline / use static guidance'}).click();await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(()=>window.__state.eligible=false);await page.getByRole('button',{name:'AI Terms & Consent',exact:true}).click();await expect(dialog.getByRole('checkbox')).toBeDisabled();await expect(dialog.getByRole('button',{name:'Accept terms'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  const calls=await page.evaluate(()=>window.__calls);assert.ok(calls.some(c=>c.revoke===true));assert.ok(calls.some(c=>c.action==='accept'&&c.acceptance===true));assert.ok(calls.some(c=>c.action==='withdraw'));assert.ok(calls.some(c=>c.action==='decline'));
  assert.ok(calls.every(c=>!('verifierUserId' in c)));assert.equal(errors.length,0);assert.equal(external.length,0);
  console.log('PASS Chromium native popups: created-account Pending default, unchecked confirmation, certification/revocation, unavailable authority, versioned consent accept/withdraw/decline, ineligible denial and Escape/close; synthetic actions only, zero external requests');
 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
