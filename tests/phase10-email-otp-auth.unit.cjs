/* eslint-disable @typescript-eslint/no-require-imports */
// Real JWT/cookie/account boundaries with an in-memory user repository. No environment files or DB.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const names=['NODE_ENV','JWT_SECRET','THESISHS_EMAIL_OTP_SECRET'];
const previous=Object.fromEntries(names.map(n=>[n,process.env[n]]));
Object.assign(process.env,{NODE_ENV:'test',JWT_SECRET:'web-test-only-'.repeat(5),THESISHS_EMAIL_OTP_SECRET:'otp-test-only-'.repeat(5)});
const jar=new Map(), options=new Map();
let account, comparisons=0;
const original=Module._load;
const users={
    findUserById:async id=>account?.id===id?account:undefined,
    findUserByEmail:async email=>account?.email===email?account:undefined,
};
Module._load=function(id,...args){
    if(id==='server-only'||id==='dotenv/config') return {};
    if(id==='next/headers') return {cookies:async()=>({
        get:name=>jar.has(name)?{value:jar.get(name)}:undefined,
        set:(name,value,settings)=>{jar.set(name,value);options.set(name,settings);},
        delete:name=>jar.delete(name),
    })};
    if(id==='@/lib/repositories/user.repository'||id==='../repositories/user.repository') return users;
    if(id==='@/lib/auth/hash') return {comparePassword:async(password)=>{comparisons++;return password==='synthetic-password';},hashPassword:async()=>{throw Error('Unexpected registration');}};
    if(id==='@/lib/services/auth-rate-limit.service') return {checkAuthAttempt:async()=>({status:'allowed'}),allowAuthAttempt:async()=>true};
    if(id==='@/lib/db'||id==='postgres') throw Error('Live adapter forbidden');
    return original.call(this,id,...args);
};
const pending=require('../lib/auth/pending-verification.ts');
const session=require('../lib/auth/session.ts');
const jwt=require('../lib/auth/jwt.ts');
const {resolveCurrentAccount}=require('../lib/auth/account-principal.ts');
const {getActiveResearchActor}=require('../lib/auth/research-mutation-account.ts');
const {validateCredentials}=require('../lib/services/auth.service.ts');
function reset(){
    jar.clear();options.clear();
    account={id:21,roleId:3,email:'student@example.invalid',firstName:'Synthetic',lastName:'Student',
        password:'not-used',isActive:true,emailVerificationRequired:true,emailVerifiedAt:null};
}
const claims=()=>({userId:account.id,roleId:account.roleId,email:account.email});
test('Pending verification and protected authentication (offline)',async t=>{
    await t.test('purpose-bound cookie supports recovery and can never act as a normal session',async()=>{
        reset();await pending.createPendingVerification({userId:21,email:account.email});
        assert.deepEqual(await pending.getPendingVerification(),{userId:21,email:account.email});
        const cookie=jar.get('thesishs_pending_verification');
        const settings=options.get('thesishs_pending_verification');
        assert.equal(settings.httpOnly,true);assert.equal(settings.sameSite,'lax');assert.equal(settings.maxAge,3600);
        assert.equal(await jwt.verifyToken(cookie),null);
        jar.set('thesishs_session',cookie);assert.equal(await session.getSession(),null);
        jar.set('thesishs_pending_verification',await jwt.createToken(claims()));assert.equal(await pending.getPendingVerification(),null);
    });
    await t.test('expired, future-issued, altered and cross-purpose pending cookies reject',async()=>{
        reset();const {SignJWT}=await import('jose');const {emailOtpKey}=require('../lib/auth/email-otp-config.ts');
        const now=Math.floor(Date.now()/1000);
        for(const patch of [{iat:now-3601,exp:now-1},{iat:now+60,exp:now+3660},{iat:now,exp:now+7200}]){
            const token=await new SignJWT({userId:21,email:account.email,...patch}).setProtectedHeader({alg:'HS256',typ:'email-verification+jwt'})
                .setIssuer('thesishs-email-verification').setAudience('thesishs-email-verification').sign(emailOtpKey('pending-cookie'));
            jar.set('thesishs_pending_verification',token);assert.equal(await pending.getPendingVerification(),null);
        }
        await pending.createPendingVerification({userId:21,email:account.email});
        jar.set('thesishs_pending_verification',jar.get('thesishs_pending_verification')+'x');assert.equal(await pending.getPendingVerification(),null);
    });
    await t.test('old valid web JWTs and session issuance cannot bypass pending eligibility',async()=>{
        reset();jar.set('thesishs_session',await jwt.createToken(claims()));
        assert.equal(await session.getSession(),null);
        assert.equal((await resolveCurrentAccount(claims())).status,'invalid');
        assert.equal(await getActiveResearchActor(3,21),null);
        await assert.rejects(session.createSession(claims()));
        assert.equal((await validateCredentials({email:account.email,password:'synthetic-password'})).status,'verification_required');
        const response=await require('../app/api/mobile/v1/auth/login/route.ts').POST(new Request('https://offline.invalid/api/mobile/v1/auth/login',{
            method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:account.email,password:'synthetic-password'})}));
        assert.equal(response.status,403);assert.equal((await response.json()).code,'STUDENT_ACCESS_REQUIRED');
        assert.ok(comparisons>=2);
    });
    await t.test('verified new Students, grandfathered Students and staff keep normal authentication',async()=>{
        for(const patch of [{emailVerifiedAt:new Date()},{emailVerificationRequired:false},{roleId:1},{roleId:2}]){
            reset();Object.assign(account,patch);
            assert.equal((await validateCredentials({email:account.email,password:'synthetic-password'})).status,'authenticated');
            await session.createSession(claims());assert.equal((await session.getSession()).userId,21);
            assert.equal((await resolveCurrentAccount(claims())).status,'active');
        }
        account.isActive=false;assert.equal(await session.getSession(),null);
    });
    await t.test('pending cookie is Secure on hosted builds and secrets must be separate',async()=>{
        reset();process.env.NODE_ENV='production';
        await pending.createPendingVerification({userId:21,email:account.email});
        assert.equal(options.get('thesishs_pending_verification').secure,true);
        const secret=process.env.THESISHS_EMAIL_OTP_SECRET;
        process.env.THESISHS_EMAIL_OTP_SECRET=process.env.JWT_SECRET;
        await assert.rejects(pending.createPendingVerification({userId:21,email:account.email}));
        process.env.THESISHS_EMAIL_OTP_SECRET=secret;process.env.NODE_ENV='test';
    });
}).finally(()=>{Module._load=original;for(const[n,v]of Object.entries(previous))if(v===undefined)delete process.env[n];else process.env[n]=v;});
