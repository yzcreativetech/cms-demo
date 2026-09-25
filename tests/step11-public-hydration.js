import {defaultContent} from '/admin/js/editor-defaults.js';
const results=[];
const check=(name,ok)=>{if(!ok)throw Error(name);results.push(name);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const textFields=['hero_eyebrow','hero_title','hero_description','about_label','about_title','about_description','footer_text'];
const imgFields={'site-logo':'site_logo_url','hero-image':'hero_image_url','about-image':'about_image_url'};
window.reads=[];
const fresh=()=>({home:{...structuredClone(defaultContent)},rows:[{...defaultContent.announcements[0],id:1}]});
let frame;
async function open(f){
 frame?.remove();window.fixture=f;
 frame=document.createElement('iframe');frame.src='/repo/index.html';document.body.append(frame);
 await new Promise(r=>frame.onload=r);
 for(let i=0;!frame.contentWindow.run&&i<200;i++)await wait(10);
 return frame.contentWindow;
}
const node=name=>frame.contentDocument.querySelector(`[data-cms="${name}"]`);
const style=()=>frame.contentDocument.documentElement.style;
const unchanged=()=>node('hero-title').textContent.trim()==='VCA Philippines'&&node('announcements').children.length===1&&node('announcement-title').textContent.includes('Welcome to the VCA')&&node('hero-button').textContent.trim()==='Learn More'&&!node('hero-button').hidden&&!style().cssText&&node('hero-image').getAttribute('src')==='assets/hero-default.webp';
try{
 if(window.live){
  const w=await open(null);check('Live logged-out hydration succeeds',await w.run);
  const {loadPublicHomepage}=await w.eval('import("/repo/js/public-data.js")');const data=await loadPublicHomepage();
  check('Fresh browser has no auth session',!Object.keys(w.localStorage).some(k=>k.includes('auth-token')));
  check('All saved text appears',textFields.every(f=>node(f.replaceAll('_','-')).textContent===data.homepage[f]));
  for(const [target,field] of Object.entries(imgFields)){
   const img=node(target);img.loading='eager';await img.decode();
   check('Live '+target+' loaded',img.src===new URL(data.homepage[field],frame.contentDocument.baseURI).href&&img.naturalWidth>0);
  }
  check('Saved button applied',data.homepage.hero_button_text?node('hero-button').textContent===data.homepage.hero_button_text&&node('hero-button').href===new URL(data.homepage.hero_button_link,frame.contentDocument.baseURI).href:node('hero-button').hidden);
  check('All announcements in saved order',[...node('announcements').querySelectorAll('h2')].map(n=>n.textContent).join('|')===data.announcements.map(r=>r.announcement_title).join('|'));
  check('Saved theme colors applied',[['theme_primary_color','--vca-blue'],['theme_secondary_color','--vca-sky'],['theme_background_color','--background'],['theme_text_color','--text']].every(([f,p])=>style().getPropertyValue(p)===data.homepage[f]));
  const stack='system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const named={'poppins':'Poppins','montserrat':'Montserrat','inter':'Inter','roboto':'Roboto','open-sans':'Open Sans','lato':'Lato','merriweather':'Merriweather'};
  check('Saved font stacks applied',[['theme_heading_font','--heading-font'],['theme_body_font','--body-font']].every(([f,p])=>style().getPropertyValue(p)===(data.homepage[f]==='system-default'?stack:`"${named[data.homepage[f]]}", ${stack}`)));
  check('Live network only reads with no auth actions',w.calls.length>=2&&w.calls.every(c=>c.method==='GET'&&!c.url.includes('/auth/')&&!c.url.includes('/storage/')));
  check('Live no uncaught errors',!w.errors.length);
 }else{
  let f=fresh();textFields.forEach(k=>f.home[k]='<b>'+k+'</b>');
  f.home.hero_button_text='<b>Go</b>';f.home.hero_button_link='pages/welcome.html';
  f.home.theme_primary_color='#123456';f.home.theme_secondary_color='#234567';f.home.theme_background_color='#345678';f.home.theme_text_color='#456789';
  f.rows=[{...f.rows[0],id:8,sort_order:2,announcement_title:'Third'},{...f.rows[0],id:7,sort_order:1,announcement_title:'Second'},{...f.rows[0],id:2,sort_order:1,announcement_title:'<b>First</b>'}];
  let w=await open(f);check('Static content visible before reads resolve',unchanged());check('Hydration succeeds',await w.run);
  check('All text targets hydrate literally',textFields.every(k=>node(k.replaceAll('_','-')).textContent===f.home[k]));
  check('No HTML injection',!frame.contentDocument.querySelector('b'));
  check('Button text and repository-relative URL',node('hero-button').textContent==='<b>Go</b>'&&node('hero-button').href.endsWith('/repo/pages/welcome.html'));
  for(const [target,field] of Object.entries(imgFields))check(target+' relative path and preserved alt',node(target).src===new URL(f.home[field],frame.contentDocument.baseURI).href&&!!node(target).alt);
  check('Four color variables applied',['--vca-blue','--vca-sky','--background','--text'].every((p,i)=>style().getPropertyValue(p)===['#123456','#234567','#345678','#456789'][i]));
  check('Background applies to main surfaces',[frame.contentDocument.body,frame.contentDocument.querySelector('.site-header'),node('announcements').firstChild].every(n=>w.getComputedStyle(n).backgroundColor==='rgb(52, 86, 120)'));
  check('System font maps exactly',style().getPropertyValue('--body-font')==='system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  check('All announcements sorted by order then ID',[...node('announcements').querySelectorAll('h2')].map(n=>n.textContent).join('|')==='<b>First</b>|Second|Third');
  check('SELECT filters and ascending ordering',reads.some(r=>r.table==='homepage_content'&&r.one&&r.filters[0][0]==='id'&&r.filters[0][1]===1)&&reads.some(r=>r.table==='homepage_announcements'&&r.filters[0][0]==='homepage_id'&&r.filters[0][1]===1&&JSON.stringify(r.orders)==='[["sort_order",{"ascending":true}],["id",{"ascending":true}]]'));
  const {prepareHydration}=await w.eval('import("/repo/js/homepage-hydration.js")');
  for(const [token,family] of Object.entries({poppins:'Poppins',montserrat:'Montserrat',inter:'Inter',roboto:'Roboto','open-sans':'Open Sans',lato:'Lato',merriweather:'Merriweather'})){
   f.home.theme_heading_font=token;f.home.theme_body_font=token;prepareHydration({homepage:f.home,announcements:[]})();check(token+' font allowlist',style().getPropertyValue('--heading-font').startsWith('"'+family+'", system-ui')&&style().getPropertyValue('--body-font')===style().getPropertyValue('--heading-font'));
  }
  for(const link of ['#about','https://example.org/path','http://example.org/','mailto:hello@example.org','tel:+1234']){f.home.hero_button_link=link;prepareHydration({homepage:f.home,announcements:[]})();check('Button protocol '+link,node('hero-button').href===new URL(link,frame.contentDocument.baseURI).href);}
  f=fresh();f.home.hero_button_text='';f.home.hero_button_link='';f.rows=[];w=await open(f);await w.run;
  check('Empty button hidden accessibly',node('hero-button').hidden&&w.getComputedStyle(node('hero-button')).display==='none');check('Successful zero rows clears sample',node('announcements').children.length===0);
  f=fresh();f.home.hero_button_link='javascript:alert(1)';f.home.site_logo_url='blob:bad';f.home.hero_image_url='file:///C:/bad';f.home.about_image_url='data:image/png,x';f.home.theme_primary_color='red; background:url(x)';f.home.theme_body_font='toString';
  w=await open(f);await w.run;check('Dangerous button retains authored fallback',node('hero-button').getAttribute('href')==='#about');check('Unsafe images retain authored sources',Object.entries(imgFields).every(([t,k])=>node(t).getAttribute('src')===defaultContent[k]));check('Invalid theme values retain defaults',!style().getPropertyValue('--vca-blue')&&!style().getPropertyValue('--body-font'));
  f=fresh();f.home.hero_image_url='https://example.org/saved.webp';w=await open(f);await w.run;check('HTTPS persisted image assigned',node('hero-image').src==='https://example.org/saved.webp');
  for(const [label,change] of [['Homepage failure',f=>f.fail='homepage_content'],['Announcement failure',f=>f.fail='homepage_announcements'],['Missing singleton',f=>f.home=null],['Client/CDN failure',f=>f.clientFail=true],['Network failure',f=>f.networkFail=true],['Malformed homepage',f=>f.home.hero_title={}],['Malformed announcements',f=>f.rows={}],['Malformed row',f=>f.rows=[null]]]){
   f=fresh();change(f);w=await open(f);check(label+' preserves full fallback',!(await w.run)&&unchanged());check(label+' handled without uncaught errors',!w.errors.length);
  }
  f=fresh();w=await open(f);node('footer-text').removeAttribute('data-cms');check('Missing DOM target prevents partial application',!(await w.run)&&unchanged());
  check('Fixture network has no writes',w.calls.every(c=>c.method==='GET'));
 }
 frame?.remove();const out=document.createElement('pre');out.id='test-results';out.textContent='PASS\n'+results.join('\n');document.body.replaceChildren(out);
}catch(e){const out=document.createElement('pre');out.id='test-results';out.textContent='FAIL\n'+e.stack+'\nPassed: '+results.join(', ');document.body.replaceChildren(out);}

if(window.live)await fetch("/test-result?"+encodeURIComponent(document.getElementById("test-results").textContent));
