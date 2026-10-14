/* eslint-disable @typescript-eslint/no-require-imports */
// Existing local synthetic accounts. No management, notification or consent mutations.
// Synthetic repository detail visits retain the existing view-counter behavior.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost'); assert.equal(target.pathname, '/thesishs_ai');
const original = Module._load;
Module._load = function(id,...args) { return id === 'server-only' ? {} : original.call(this,id,...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const origin='http://127.0.0.1:3022', marker='PHASE6_ACCEPTANCE_20260929';
let server, browser;
async function main() {
    const actors=await db.execute(sql`SELECT id,role_id FROM users WHERE is_active=true
        AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const users=[1,2,3].map(role=>actors.find(a=>a.role_id===role));
    assert.ok(users.every(Boolean),'Existing active synthetic roles required');
    const papers=await db.execute(sql`SELECT p.id,p.title,p.category,g.school_year,g.strand,r.id AS repository_id,r.view_count
        FROM research_papers p JOIN research_groups g ON g.id=p.group_id JOIN repositories r ON r.paper_id=p.id
        WHERE (p.title LIKE ${marker+'%'} OR p.title ILIKE '%test%' OR p.title LIKE 'SPRINT%')
        AND r.is_published=true AND p.status='Approved'
        AND EXISTS(SELECT 1 FROM submissions s WHERE s.paper_id=p.id AND s.status='Approved') ORDER BY p.id`);
    console.log('Existing eligible synthetic discovery papers: '+papers.length);
    assert.ok(papers.length>0,'Existing eligible synthetic research required');
    const paper=papers[0];
    const before=await db.execute(sql`SELECT id,paper_id,is_published,published_at,download_count FROM repositories ORDER BY id`);
    server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3022'],{windowsHide:true,stdio:'ignore'});
    let ready=false;
    for(let i=0;i<60;i++){
        if(server.exitCode!==null)throw new Error('Temporary server exited');
        try{if((await fetch(origin+'/login')).ok){ready=true;break;}}catch{/* startup */}
        await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(ready); browser=await chromium.launch();
    const errors=[];
    for(const width of [360,1280]){
        const context=await browser.newContext({viewport:{width,height:900}});
        let blocked=false;
        await context.route('**/*',route=>{
            if(new URL(route.request().url()).origin!==origin){errors.push('external request');return route.abort();}
            if(blocked && route.request().method()==='POST')return route.abort();
            return route.continue();
        });
        const page=await context.newPage();
        page.on('pageerror',()=>errors.push('page error'));
        page.on('console',m=>{if(m.type()==='error' && !(blocked && m.text().includes('net::ERR_FAILED')))errors.push('console error');});
        page.on('response',r=>{if(r.status()>=500)errors.push('HTTP 5xx');});
        async function signIn(actor){
            await context.addCookies([{name:'thesishs_session',value:await createToken({userId:actor.id,roleId:actor.role_id,email:'phase94-synthetic@example.invalid'}),url:origin,httpOnly:true,sameSite:'Lax'}]);
        }
        async function layout(){
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
            await page.keyboard.press('Tab');
            assert.ok(await page.evaluate(()=>document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3),'Visible keyboard focus');
        }
        // Both authorized roles exercise discovery at both widths.
        for(const actor of [users[2],users[1]]){
            await signIn(actor); await page.goto(origin+'/dashboard/repository');
            await expect(page.getByRole('heading',{level:1})).toHaveText('Research Repository');
            await page.getByLabel('Search title, abstract, or keywords').fill(paper.title);
            await page.getByRole('button',{name:'Search and filter',exact:true}).click();
            await expect(page.getByRole('link',{name:paper.title,exact:true})).toBeVisible();
            const shown=await page.locator('.repository-results a').evaluateAll(links=>links.map(link=>Number(link.getAttribute('href').split('/').pop())));
            assert.ok(shown.every(id=>papers.some(p=>p.id===id)),'Only eligible published fixture papers listed');
            await page.getByRole('button',{name:'Clear filters',exact:true}).click();
            await expect(page.getByLabel('Search title, abstract, or keywords')).toHaveValue('');
            const next=page.getByRole('link',{name:'Next',exact:true});
            if(await next.count()){
                await next.click();
                await expect(page).toHaveURL(/[?&]page=2(?:&|$)/);
                assert.equal(new URL(page.url()).searchParams.get('page'),'2');
                await page.getByRole('link',{name:'Previous',exact:true}).click();
                await expect(page).toHaveURL(/[?&]page=1(?:&|$)/);
            }else console.log('LIMIT: current repository has no second result page; existing pagination code and prior Phase 6 evidence retained.');
            await page.getByLabel('Search title, abstract, or keywords').fill(paper.title);
            await page.getByLabel('Category',{exact:true}).selectOption(paper.category ?? '');
            await page.getByLabel('School year',{exact:true}).selectOption(paper.school_year);
            await page.getByLabel('Strand',{exact:true}).selectOption(paper.strand);
            await page.getByRole('button',{name:'Search and filter',exact:true}).click();
            await expect(page.getByRole('link',{name:paper.title,exact:true})).toBeVisible();
            await layout();
            if(actor.role_id===3)await page.screenshot({path:join(tmpdir(),'phase94-repository-'+width+'.png')});
            await page.getByLabel('Search title, abstract, or keywords').fill('PHASE94_NO_MATCH_SYNTHETIC');
            await page.getByRole('button',{name:'Search and filter',exact:true}).click();
            await expect(page.getByText('No results match your search and filters.',{exact:true})).toBeVisible();
            await page.getByRole('button',{name:'Clear filters',exact:true}).first().click();
            await expect(page.getByLabel('Search title, abstract, or keywords')).toHaveValue('');
        }
        // One ordinary detail visit per width, only on the known synthetic paper.
        await page.goto(origin+'/dashboard/repository/'+paper.id);
        await expect(page.getByRole('heading',{level:1})).toHaveText(paper.title);
        await expect(page.getByRole('button',{name:'View PDF',exact:true})).toBeVisible();
        await expect(page.getByRole('button',{name:'Download PDF',exact:true})).toBeVisible();
        await layout(); await page.screenshot({path:join(tmpdir(),'phase94-detail-'+width+'.png')});
        blocked=true;
        await page.getByRole('button',{name:'Download PDF',exact:true}).click();
        await expect(page.locator('p.form-message[role="alert"]')).toBeVisible(); blocked=false;
        await page.getByRole('link',{name:'Back to Repository',exact:true}).click();
        await expect(page).toHaveURL(origin+'/dashboard/repository');
        await signIn(users[0]);
        for(const [path,heading] of [['users','User Management'],['groups','Research Groups'],['repository','Repository Management'],['reports','Admin Reports']]){
            await page.goto(origin+'/dashboard/admin/'+path);
            await expect(page.getByRole('heading',{level:1})).toHaveText(heading);
            await layout();
            const scroll=page.locator('.admin-table-scroll');
            if(await scroll.count()){
                await expect(scroll).toHaveAttribute('tabindex','0');
                await scroll.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
                const control=scroll.getByRole('button').last();
                await control.scrollIntoViewIfNeeded();
                const bounds=await control.boundingBox(); assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width,'Admin action reachable');
                await scroll.evaluate(e=>{e.scrollLeft=0;});
            }
            await page.evaluate(()=>window.scrollTo(0,0));
            await page.screenshot({path:join(tmpdir(),'phase94-admin-'+path+'-'+width+'.png')});
            if(path==='users'){
                await page.getByRole('button',{name:'AI eligibility',exact:true}).first().click();
                const dialog=page.getByRole('dialog'); await expect(dialog).toBeVisible();
                const bounds=await dialog.boundingBox(); assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width);
                await dialog.getByRole('button',{name:'Close',exact:true}).click(); await expect(dialog).not.toBeVisible();
            }
            if(path==='reports'){
                await expect(page.getByText('AI interpretation is disabled.',{exact:false})).toBeVisible();
                await page.getByRole('button',{name:'AI Terms & Consent',exact:true}).click();
                await expect(page.getByRole('dialog')).toBeVisible();
                await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
                await page.getByRole('button',{name:'Explain report metrics',exact:true}).click();
                await expect(page.locator('.assistance-panel > div[role="status"]')).not.toHaveText('Loading static guidance...');
                await expect(page.locator('.assistance-panel > div[role="status"]')).not.toBeEmpty();
            }
        }
        for(const [actor,role] of [[users[0],'admin'],[users[1],'adviser'],[users[2],'student']]){
            await signIn(actor); await page.goto(origin+'/dashboard/'+role+'/notifications');
            await layout(); await expect(page.getByRole('heading',{level:1})).toBeVisible();
        }
        await page.goto(origin+'/dashboard/guide');
        await page.getByRole('region',{name:'Choose a guide question'}).getByRole('button').first().click();
        await expect(page.getByRole('region',{name:'System guidance'}).getByRole('heading',{level:3})).toBeVisible();
        await expect(page.locator('input, textarea')).toHaveCount(0);
        await layout(); await page.screenshot({path:join(tmpdir(),'phase94-guide-'+width+'.png')});
        for(const actor of [users[2],users[1]]){
            await signIn(actor);
            for(const path of ['users','groups','repository','reports']){
                await page.goto(origin+'/dashboard/admin/'+path);
                await expect(page).toHaveURL(origin+'/dashboard');
            }
        }
        await context.clearCookies(); await page.goto(origin+'/dashboard/repository');
        await expect(page).toHaveURL(origin+'/login'); await context.close();
    }
    assert.deepEqual(await db.execute(sql`SELECT id,paper_id,is_published,published_at,download_count FROM repositories ORDER BY id`),before,'Publication/download state unchanged');
    const [after]=await db.execute(sql`SELECT view_count FROM repositories WHERE id=${paper.repository_id}`);
    assert.ok(after.view_count>=paper.view_count+2,'Existing synthetic detail view-count behavior retained');
    assert.deepEqual(errors,[]);
    console.log('PASS discovery Student/Adviser, filters/pagination/empty/reset/eligible fixtures, synthetic detail/document transport error, Admin views/table reachability/dialog close/static assistance, three notification roles, static Student guide, Student/Adviser Admin denial, anonymous redirect and 360/1280 focus/overflow.');
    console.log('LIMIT: existing synthetic detail view counter incremented; publication/download state unchanged. No management, notification, consent, storage or provider mutations; real PDF fetch/expiry and Safari/Edge not tested.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();process.exit(process.exitCode||0);});
