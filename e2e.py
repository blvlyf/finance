import json,sys
from playwright.sync_api import sync_playwright
errs=[];dialogs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':400,'height':800},service_workers='allow')
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
    pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' else None)
    pg.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
    pg.goto('http://localhost:8765/index.html');pg.wait_for_timeout(800)
    # onboarding
    assert pg.locator('.sheet h3').first.inner_text().startswith('Welcome'),'no onboarding'
    pg.fill('[name=name]','Tester');pg.click('[data-x=next]')
    pg.fill('[name=day]','1');pg.fill('[name=cash0]','1000');pg.click('[data-x=next]')
    pg.click('[data-p=forest]');pg.click('[data-x=next]')
    pg.click('[data-x=next]');pg.wait_for_timeout(300)
    assert pg.evaluate("S.set.name")=='Tester' and pg.evaluate("S.set.cash0")==1000
    pg.click('nav button:has-text("Money")');pg.wait_for_timeout(300)
    # add entries through the sheet
    pg.click('nav .plus');pg.wait_for_timeout(300)
    pg.fill('[name=amt]','50');pg.fill('[name=note]','Matooke');pg.click('[data-x=save]');pg.wait_for_timeout(300)
    assert pg.evaluate("S.tx.length")==1
    # learned rule applies on next entry
    pg.click('nav .plus');pg.wait_for_timeout(300)
    pg.fill('[name=note]','matooke');pg.fill('[name=amt]','10');pg.evaluate("document.querySelector('[name=note]').dispatchEvent(new Event('change',{bubbles:true}))")
    cat=pg.locator('.ddb span').inner_text();print('category after rule:',cat)
    pg.click('[data-x=save]');pg.wait_for_timeout(300)
    # overspend dialog is in-app
    pg.click('nav .plus');pg.wait_for_timeout(300);pg.fill('[name=amt]','999999');pg.click('[data-x=save]');pg.wait_for_timeout(300)
    assert pg.locator('#dlg.on .dbox').count()==1,'no in-app dialog'
    print('dialog says:',pg.locator('#dmg').inner_text()[:60]);pg.keyboard.press('Escape');pg.wait_for_timeout(200)
    assert pg.locator('#dlg.on').count()==0
    pg.keyboard.press('Escape');pg.wait_for_timeout(300)
    # money tab shows safe to spend + trends
    pg.click('nav button:has-text("Money")');pg.wait_for_timeout(500)
    html=pg.inner_html('#app');assert 'Safe to spend today' in html and 'Last 6 months' in html
    # auto recurring bill
    pg.evaluate("UP().push({id:'u1',what:'Netflix',amt:5,d:today(),rep:'monthly',auto:1,cat:'Fun',acc:''});LH='';autoTick=autoTick;atAt=0;autoTick()");pg.wait_for_timeout(400)
    assert pg.evaluate("S.tx.some(t=>t.auto&&t.note==='Netflix')"),'auto bill not recorded'
    # set a PIN
    pg.click('nav button:has-text("Settings")');pg.wait_for_timeout(300)
    pg.click('button.sch:has-text("Privacy")');pg.click('button:has-text("Set PIN")');pg.wait_for_timeout(200)
    pg.fill('#dinp','abc');pg.press('#dinp','Enter');pg.wait_for_timeout(200)
    assert 'too short' in pg.locator('#dmg').inner_text();pg.click('#dlg .btn');pg.wait_for_timeout(100)
    pg.click('button:has-text("Set PIN")');pg.fill('#dinp','secret-pin-1');pg.press('#dinp','Enter');pg.wait_for_timeout(200)
    pg.fill('#dinp','secret-pin-1');pg.press('#dinp','Enter');pg.wait_for_timeout(1500)
    raw=pg.evaluate("""async()=>{const r=await kget('s');return JSON.stringify(r)}""")
    assert 'Matooke' not in raw and 'Tester' not in raw and '"enc"' in raw,'data not encrypted'
    print('encrypted at rest: ok')
    # reload -> locked
    pg.reload();pg.wait_for_timeout(800)
    assert pg.locator('#lock.on').count()==1
    pg.fill('#pin','wrong');pg.click('#lock .btn.pri');pg.wait_for_timeout(1500)
    assert 'Wrong' in pg.locator('#pinmsg').inner_text()
    pg.fill('#pin','secret-pin-1');pg.click('#lock .btn.pri');pg.wait_for_timeout(2000)
    assert pg.locator('#lock.on').count()==0 and pg.evaluate("S.set.name")=='Tester'
    # idle lock
    pg.evaluate("hiddenAt=Date.now()-120000;document.dispatchEvent(new Event('visibilitychange'))");pg.wait_for_timeout(500)
    print('idle lock:',pg.locator('#lock.on').count()==1)
    pg.fill('#pin','secret-pin-1');pg.click('#lock .btn.pri');pg.wait_for_timeout(2000)
    # legacy migration path
    pg.evaluate("""async()=>{await kclear();META=null;DK=null;const h=await legacyHash('1234');await kput('s',{set:{name:'Old',pin:h,cur:'UGX',day:1},tx:[{id:'q',k:'inc',d:'2026-11-02',amt:900,cat:'Salary',note:'old data'}],goals:[],debts:[],bud:{},cats:[],acc:[],split:{}})}""")
    pg.reload();pg.wait_for_timeout(800)
    pg.fill('#pin','1234');pg.click('#lock .btn.pri');pg.wait_for_timeout(2500)
    assert pg.evaluate("S.set.name")=='Old' and pg.evaluate("hasPin()"),'legacy migrate failed'
    raw=pg.evaluate("async()=>JSON.stringify(await kget('s'))");assert 'old data' not in raw
    print('legacy PIN migrated to encryption: ok')
    # views render without errors
    for t in ['dayv','home','act','plan','sett','jrnv']:
        pg.evaluate(f"go('{t}')");pg.wait_for_timeout(150)
    for s_ in ['jr','tk','hb','cl','nt']:
        pg.evaluate(f"jsub='{s_}';render()");pg.wait_for_timeout(100)
    for s_ in ['bud','up','goal','debt','split']:
        pg.evaluate(f"go('plan');sub='{s_}';render()");pg.wait_for_timeout(100)
    pg.evaluate("report('month')");pg.wait_for_timeout(300);pg.evaluate("closeRep()")
    pg.evaluate("weekReview()");pg.wait_for_timeout(200);assert pg.locator('.sheet h3').inner_text()=='Your week'
    pg.keyboard.press('Escape')
    # snapshots exist
    print('snapshots:',pg.evaluate("snapList().then(l=>l.length)"))
    # service worker registered
    pg.wait_for_timeout(500);print('sw:',pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r)"))
    b.close()
print('native dialogs used:',dialogs)
print('errors:',errs)
sys.exit(1 if errs or dialogs else 0)
