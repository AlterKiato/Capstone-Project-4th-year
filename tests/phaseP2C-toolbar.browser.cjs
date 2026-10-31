/* eslint-disable @typescript-eslint/no-require-imports */
// Focused checks called by the existing isolated workspace harness; no live services.
const assert = require('node:assert/strict');
const { expect } = require('@playwright/test');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const Module = require('node:module');
const { resolve } = require('node:path');

async function hydration(context) {
    const component = `import React from 'react';import Editor from './app/dashboard/adviser/submissions/FeedbackEditor';const content=<Editor value='' disabled={false} onChange={()=>{}} onError={()=>{}}/>;`;
    const options={write:false,outfile:'hydrate.js',bundle:true,format:'cjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}};
    // Real React SSR with browser globals absent, then hydrate the exact same component.
    const server=await build({...options,platform:'node',external:['react','react-dom','react-dom/server','react/jsx-runtime'],stdin:{resolveDir:process.cwd(),loader:'tsx',contents:component+`import{renderToString}from'react-dom/server';module.exports=renderToString(content);`}});
    const filename=resolve('.next/p2c3c-audit/hydration-test.cjs'),compiled=new Module(filename);
    compiled.filename=filename;compiled.paths=Module._nodeModulePaths(process.cwd());
    compiled._compile(server.outputFiles.find(file=>file.path.endsWith('.js')).text,filename);
    const html=compiled.exports;
    assert.equal((html.match(/<button/g)||[]).length,5);
    assert.ok(!html.includes('role="tooltip"'));
    const client=await build({...options,platform:'browser',format:'iife',stdin:{resolveDir:process.cwd(),loader:'tsx',contents:component+`import{hydrateRoot}from'react-dom/client';window.__hydrationErrors=[];hydrateRoot(document.getElementById('root'),content,{onRecoverableError:()=>window.__hydrationErrors.push('recoverable hydration error')});`}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.name));page.on('console',message=>{if(message.type()==='error')errors.push('console error')});
    try {
        await page.route('**/hydration',route=>route.fulfill({contentType:'text/html',body:`<html><body><div id="root">${html}</div></body></html>`}));
        await page.goto('http://workspace.invalid/hydration');
        await page.addStyleTag({content:client.outputFiles.find(file=>file.path.endsWith('.css')).text});
        await page.addScriptTag({content:client.outputFiles.find(file=>file.path.endsWith('.js')).text});
        const editor=page.getByRole('textbox',{name:'Feedback Comments',exact:true});
        await editor.fill('Synthetic hydrated feedback');await editor.press('ControlOrMeta+a');
        await page.getByRole('button',{name:'Bold',exact:true}).click();
        await expect(editor.locator('b,strong')).toHaveText('Synthetic hydrated feedback');
        assert.deepEqual(await page.evaluate(()=>window.__hydrationErrors),[]);assert.deepEqual(errors,[]);
    } finally {await page.close();}
}

async function desktop(page) {
    const editor = page.getByRole('textbox', { name: 'Feedback Comments', exact: true });
    const toolbar = page.getByRole('group', { name: 'Feedback formatting', exact: true });
    const tooltip = page.getByRole('tooltip');
    const names = ['Bold', 'Italic', 'Underline', 'Bulleted list', 'Numbered list'];
    assert.equal(await toolbar.getByRole('button').count(), 5);
    for (const name of names) {
        const button = toolbar.getByRole('button', { name, exact: true });
        assert.equal((await button.innerText()).trim(), '');
        assert.equal(await button.locator('svg[aria-hidden="true"]').count(), 1);
        assert.equal(await button.evaluate(element => element.getBoundingClientRect().height), 38);
    }
    assert.ok(await toolbar.evaluate(element => element.getBoundingClientRect().width < 220));
    await editor.fill('Synthetic tooltip selection'); await editor.press('ControlOrMeta+a');
    const original = await editor.evaluate(root => window.__feedbackCodec.encodeFeedback(window.__readEditor(root)));
    const started = Date.now();
    await toolbar.getByRole('button', {name:'Bold',exact:true}).hover();
    await expect(tooltip).toHaveCount(0);
    await expect(tooltip).toBeVisible({timeout:2000});
    assert.ok(Date.now() - started >= 250, 'First hover should have a deliberate delay');
    await expect(tooltip).toContainText('Bold'); await expect(tooltip.locator('kbd')).toHaveText('Ctrl/Cmd+B');
    for (const name of names.slice(1)) {
        await toolbar.getByRole('button', {name,exact:true}).hover();
        await expect(tooltip).toContainText(name, {timeout:350});
    }
    await expect(tooltip.locator('kbd')).toHaveCount(0);
    assert.equal(await editor.evaluate(root => window.__feedbackCodec.encodeFeedback(window.__readEditor(root))), original);
    assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0);
    await page.keyboard.press('Escape'); await expect(tooltip).toHaveCount(0);
    // A toolbar near the viewport edge must flip its tooltip instead of clipping it.
    await page.evaluate(()=>{document.body.style.paddingBottom='1000px';window.scrollBy(0,document.querySelector('[aria-label="Bold"]').getBoundingClientRect().top-2)});
    await toolbar.getByRole('button',{name:'Bold',exact:true}).hover();
    await expect(tooltip).toHaveAttribute('data-side','bottom');
    assert.ok(await tooltip.evaluate(element=>element.getBoundingClientRect().top>=0));
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{document.body.style.paddingBottom='';window.scrollTo(0,0)});
    // Keyboard focus opens without formatting; Space still applies the selected command.
    const bold = toolbar.getByRole('button',{name:'Bold',exact:true});
    const focusBold = async () => {
        await editor.focus();
        for (let index=0;index<5;index++) await page.keyboard.press('Shift+Tab');
        await expect(bold).toBeFocused();
    };
    await focusBold(); await expect(tooltip).toContainText('Bold');
    await expect(bold).toHaveAttribute('aria-keyshortcuts','Control+B Meta+B');
    await expect(bold).toHaveAttribute('aria-describedby',/.+/);
    assert.equal(await bold.evaluate(element => getComputedStyle(element).outlineStyle),'solid');
    await page.keyboard.press('Space'); await expect(editor.locator('b,strong')).toHaveText('Synthetic tooltip selection');
    await expect(bold).toHaveAttribute('aria-pressed','true');
    await page.keyboard.press('Escape'); await expect(tooltip).toHaveCount(0);

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.mouse.move(0,0); await page.waitForTimeout(350);
    await bold.hover(); await expect(tooltip).toBeVisible({timeout:2000});
    assert.deepEqual(await tooltip.locator('.warm-tooltip__box').evaluate(element => {
        const style=getComputedStyle(element);return {transform:style.transform,filter:style.filter,opacity:style.opacity};
    }),{transform:'none',filter:'none',opacity:'1'});
    assert.equal(await tooltip.locator('.warm-tooltip__layer').last().evaluate(element => getComputedStyle(element).transform),'none');
    await page.keyboard.press('Escape');

    for (const theme of ['Light','Dark','System']) {
        if (theme==='System') await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
        await page.getByRole('button',{name:'Change theme',exact:true}).click();
        await page.getByRole('menuitemradio',{name:theme,exact:true}).click();
        await focusBold(); await expect(tooltip).toContainText('Bold');
        const appearance=await tooltip.evaluate(element=>({box:getComputedStyle(element.querySelector('.warm-tooltip__box')).backgroundColor,
            editor:getComputedStyle(document.querySelector('[role="textbox"]')).backgroundColor,font:getComputedStyle(element).fontFamily,
            bodyFont:getComputedStyle(document.body).fontFamily,rect:element.getBoundingClientRect().toJSON(),vw:innerWidth,vh:innerHeight}));
        assert.equal(appearance.box,appearance.editor);assert.equal(appearance.font,appearance.bodyFont);
        assert.ok(appearance.rect.left>=0&&appearance.rect.right<=appearance.vw&&appearance.rect.top>=0&&appearance.rect.bottom<=appearance.vh);
        await page.screenshot({path:join(tmpdir(),`thesishs-p2c3c-tooltip-${theme.toLowerCase()}.png`),fullPage:false});
        await page.keyboard.press('Escape');
    }
    // Native scrolling: no new scroll regions, no wheel/key event interception.
    await editor.fill('Short feedback');
    assert.ok(await editor.evaluate(element=>element.scrollHeight<=element.clientHeight));
    const longText=Array.from({length:100},(_,i)=>`Synthetic feedback line ${i+1}`).join('\n');
    await editor.fill(longText); await editor.evaluate(element=>element.scrollTop=0);
    await editor.hover(); await page.mouse.wheel(0,320);
    await expect.poll(()=>editor.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    await editor.press('ControlOrMeta+Home'); await editor.press('PageDown');
    await expect.poll(()=>editor.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    const width=await editor.evaluate(element=>element.clientWidth);
    await page.getByRole('heading',{name:'Adviser Review',exact:true}).hover(); await editor.focus();
    assert.equal(await editor.evaluate(element=>element.clientWidth),width);
    const review=page.getByRole('region',{name:'Adviser review content',exact:true});
    assert.ok(await review.evaluate(element=>element.scrollHeight>element.clientHeight));
    await review.evaluate(element=>element.scrollTop=0);await review.focus();await review.press('PageDown');
    await expect.poll(()=>review.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    await page.emulateMedia({forcedColors:'active'});
    assert.equal(await editor.evaluate(element=>getComputedStyle(element).scrollbarWidth),'auto');
    assert.equal(await review.evaluate(element=>getComputedStyle(element).scrollbarColor),'auto');
    await page.emulateMedia({forcedColors:'none',reducedMotion:'no-preference',colorScheme:'light'});
    // The document iframe is still controlled only by the retained PDF workflow tests.
    assert.equal(await page.locator('iframe').count(),0);
    assert.equal(await page.evaluate(()=>window.__feedbackCalls.length),0);
    await page.evaluate(()=>window.render(2)); await expect(page.getByLabel('Submission version',{exact:true})).toHaveValue('2');
    await page.evaluate(()=>window.render(1)); await expect(page.getByLabel('Submission version',{exact:true})).toHaveValue('1');
    await editor.fill('');
}

async function touch(page, context) {
    const editor=page.getByRole('textbox',{name:'Feedback Comments',exact:true});
    const bold=page.getByRole('button',{name:'Bold',exact:true});
    await editor.fill('Synthetic touch selection'); await editor.press('ControlOrMeta+a');
    assert.equal(await bold.evaluate(element=>element.getBoundingClientRect().height),44);
    await bold.tap(); await expect(editor.locator('b,strong')).toHaveText('Synthetic touch selection');
    await expect(bold).toHaveAttribute('aria-pressed','true');
    await page.keyboard.press('Escape');
    const before=await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root)));
    const client=await context.newCDPSession(page);
    const rect=await bold.boundingBox();
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});
    await expect(page.getByRole('tooltip')).toContainText('Bold',{timeout:2000});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root))),before,'Long-press tooltip inspection must not format');
    await page.keyboard.press('Escape');
    // A subsequent real tap must not be swallowed by long-press click suppression.
    await bold.tap(); await expect(editor.locator('b,strong')).toHaveCount(0);
    await editor.fill(Array.from({length:90},(_,i)=>`Synthetic touch line ${i}`).join('\n'));
    await editor.press('ControlOrMeta+Home');
    await editor.scrollIntoViewIfNeeded();
    const editorRect=await editor.boundingBox();
    const viewportHeight=await page.evaluate(()=>innerHeight);
    const touchY=Math.min(viewportHeight-40,Math.max(80,editorRect.y+editorRect.height/2));
    await page.screenshot({path:join(tmpdir(),'thesishs-p2c3c-touch-before.png'),fullPage:false});
    await client.send('Input.synthesizeScrollGesture',{x:editorRect.x+editorRect.width/2,y:touchY,yDistance:-240,speed:500,gestureSourceType:'touch'});
    await expect.poll(()=>editor.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    assert.equal(await editor.evaluate(element=>getComputedStyle(element).scrollbarWidth),'auto');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.evaluate(()=>window.__feedbackCalls.length),0);
    await page.screenshot({path:join(tmpdir(),'thesishs-p2c3c-touch.png'),fullPage:false});
    await client.detach();
}
module.exports={desktop,touch,hydration};
