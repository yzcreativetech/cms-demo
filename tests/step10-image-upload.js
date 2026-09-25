import {fixture as db} from '/admin/js/supabase-client.js';
import {createEditorState,statesEqual} from '/admin/js/editor-state.js';
import {loadEditorContent} from '/admin/js/editor-data.js';
import {createMediaPersistence} from '/admin/js/editor-media.js';
import {defaultContent} from '/admin/js/editor-defaults.js';
const results=[];
const check=(name,ok)=>{if(!ok)throw Error(name);results.push(name);};
const el=id=>document.getElementById(id);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test){for(let i=0;i<200;i++){if(test())return;await wait(10);}throw Error('Timed out');}
const click=id=>el(id+'-button').click();
const submit=()=>el('homepage-editor-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
async function save(){submit();await until(()=>el('homepage-editor-form').getAttribute('aria-busy')==='false');}
const writes=()=>db.calls.filter(c=>c.action!=='select').length;
const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
const file=(type='image/png',name='../unsafe name.png')=>new File([png],name,{type});
function select(id,f){const d=new DataTransfer();d.items.add(f);el(id+'-input').files=d.files;el(id+'-input').dispatchEvent(new Event('change',{bubbles:true}));}
function edit(id,value){el(id).value=value;el(id).dispatchEvent(new Event('input',{bubbles:true}));}
try {
  await import('/admin/js/homepage-editor.js');await until(()=>el('hero-title').value==='Saved title');window.confirm=()=>true;
  const ids=['site-logo','hero-image','about-image'];
  const fields=['site_logo_url','hero_image_url','about_image_url'];
  const original=fields.map(f=>db.home[f]);
  for(const id of ids){select(id,file());check(id+' local preview without persistence',el(id+'-preview').src.startsWith('blob:')&&db.uploads.length===0&&writes()===0);}
  click('cancel');
  for(const type of ['image/jpeg','image/webp']){select('hero-image',file(type));check(type+' accepted before Save',el('hero-image-preview').src.startsWith('blob:')&&db.uploads.length===0);click('cancel');}
  select('hero-image',file());const local=el('hero-image-preview').src;
  for(const [label,f] of [['Invalid MIME',new File(['x'],'x.svg',{type:'image/svg+xml'})],['Empty File',new File([],'x.png',{type:'image/png'})],['Over 5 MB',new File([new Uint8Array(5*1024*1024+1)],'x.png',{type:'image/png'})]]){
    select('hero-image',f);await save();check(label+' rejected without replacing selection or writing',el('hero-image-preview').src===local&&db.uploads.length===0&&writes()===0);
  }
  click('cancel');select('hero-image',file());click('undo');check('Undo restores saved preview',!el('hero-image-preview').src.startsWith('blob:'));click('redo');check('Redo restores local preview without upload',el('hero-image-preview').src.startsWith('blob:')&&db.uploads.length===0);
  click('cancel');check('Cancel removes selection and resets history',!el('hero-image-preview').src.startsWith('blob:')&&el('undo-button').disabled&&db.uploads.length===0);
  click('restore-default');check('Defaults restore canonical images without persistence',el('hero-image-preview').src.endsWith(defaultContent.hero_image_url)&&db.uploads.length===0&&writes()===0);click('cancel');
  select('hero-image',file('image/webp'));submit();submit();submit();
  check('Upload Save locks controls',el('hero-title').disabled&&el('save-button').disabled);
  await until(()=>!el('hero-title').disabled);
  check('Single hero Save and duplicate prevention',db.uploads.length===1&&writes()===2&&db.uploads[0].path.startsWith('hero/')&&db.home.hero_image_url.includes('/cms-demo/hero/'));
  check('Unselected image URLs unchanged',db.home.site_logo_url===original[0]&&db.home.about_image_url===original[2]);
  check('Success uses public preview and clears history',el('hero-image-preview').src===db.home.hero_image_url&&el('undo-button').disabled&&el('redo-button').disabled&&el('cancel-button').disabled);
  edit('hero-title','Text only');await save();check('Text-only Save does not upload',db.uploads.length===1);
  ids.forEach((id,i)=>select(id,file(['image/png','image/webp','image/jpeg'][i])));await save();
  check('All three mappings persisted',db.uploads.length===4&&fields.every((f,i)=>db.home[f].includes('/cms-demo/'+['logos','hero','movement'][i]+'/')));
  check('Unique safe UUID paths and validated MIME options',new Set(db.uploads.map(u=>u.path)).size===4&&db.uploads.every(u=>u.bucket==='cms-demo'&&/^(logos|hero|movement)\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(u.path)&&u.options.upsert===false&&u.options.contentType===u.file.type&&u.path.endsWith({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[u.file.type])));
  select('hero-image',file());edit('footer-text','Redo me');click('undo');let preview=el('hero-image-preview').src;let count=writes();let uploads=db.uploads.length;
  db.uploadFail={after:1};await save();
  check('Upload failure retains preview and both history stacks; zero DB writes',writes()===count&&el('hero-image-preview').src===preview&&!el('undo-button').disabled&&!el('redo-button').disabled&&!el('save-button').disabled&&!el('editor-status').textContent.includes('successfully'));
  await save();check('Upload failure can retry',db.uploads.length===uploads+2&&el('editor-status').textContent.includes('successfully'));
  ids.forEach(id=>select(id,file()));count=writes();uploads=db.uploads.length;db.uploadFail={after:2};await save();
  check('Partial upload prevents all DB persistence and preserves all previews',writes()===count&&db.uploads.length===uploads+2&&ids.every(id=>el(id+'-preview').src.startsWith('blob:')));
  await save();check('Partial retry reuses successful logo',db.uploads.length===uploads+4&&el('editor-status').textContent.includes('successfully'));
  select('hero-image',file());edit('footer-text','Redo remains');click('undo');preview=el('hero-image-preview').src;uploads=db.uploads.length;
  db.fail={table:'homepage_content',action:'update',after:1};await save();
  check('DB failure retains File preview and history with accurate upload warning',db.uploads.length===uploads+1&&el('hero-image-preview').src===preview&&!el('undo-button').disabled&&!el('redo-button').disabled&&el('editor-status').textContent.includes('Uploaded images may already exist')&&!el('editor-status').textContent.includes('successfully'));
  await save();check('DB retry reuses URL and accepts saved baseline',db.uploads.length===uploads+1&&el('hero-image-preview').src===db.home.hero_image_url&&el('undo-button').disabled&&el('redo-button').disabled);
  select('hero-image',file());db.fail={table:'homepage_announcements',action:'update',after:1};await save();
  check('Partial database warning preserved',el('editor-status').textContent.includes('Some changes may already be stored'));
  uploads=db.uploads.length;const abandoned=db.uploads.at(-1).path;select('hero-image',file('image/jpeg','B.jpg'));await save();
  check('Different File gets new upload; prior orphan retained',db.uploads.length===uploads+1&&!db.home.hero_image_url.endsWith(abandoned)&&!!db.objects[abandoned]);
  const state=createEditorState(await loadEditorContent()),media=createMediaPersistence(),f=file();state.setImage('hero_image_url',f);
  const snapshot=state.currentState;uploads=db.uploads.length;db.badUrl=true;await media.prepareForSave(snapshot).then(()=>{throw Error('Expected URL failure');},()=>{});
  check('Unusable public URL rejected without live state mutation',statesEqual(state.currentState,snapshot)&&media.hasPendingUploads);
  db.badUrl=false;const prepared=await media.prepareForSave(snapshot);
  check('URL retry reuses path; snapshot clears File only',db.uploads.length===uploads+1&&prepared.media.hero_image_url.file===null&&state.currentState.media.hero_image_url.file===f&&state.canUndo);
  await media.prepareForSave(snapshot);check('Same File journal reused',db.uploads.length===uploads+1);
  media.acknowledge();await media.prepareForSave(snapshot);check('Acknowledgement clears session journal',db.uploads.length===uploads+2);
  uploads=db.uploads.length;count=writes();
  for(const mutate of [s=>s.hero_title='',s=>s.media.hero_image_url.file=new File([],'empty.png',{type:'image/png'}),s=>s.media.hero_image_url.file={type:'image/png',size:10},s=>s.media.hero_image_url=null,s=>s.id=2]){
    const invalid=state.currentState;mutate(invalid);await media.prepareForSave(invalid).then(()=>{throw Error('Expected validation failure');},()=>{});
  }
  check('Full validation rejects invalid content, images and shape before requests',uploads===db.uploads.length&&count===writes());
  db.user=false;await media.prepareForSave({...snapshot,media:{...snapshot.media,hero_image_url:{file:file()}}}).then(()=>{throw Error('Expected auth failure');},()=>{});db.user=true;
  check('Authorization failure stops before database writes',count===writes());
  const frame=document.createElement('iframe');frame.src='/reload-fixture';document.body.append(frame);await new Promise(resolve=>frame.onload=resolve);await until(()=>frame.contentDocument.getElementById('hero-title').value==='Text only');
  check('Fresh editor reload uses persisted image references (fixture)',ids.every((id,i)=>frame.contentDocument.getElementById(id+'-preview').src===db.home[fields[i]]));frame.remove();
  check('Singleton update only (fixture)',db.home.id===1&&db.calls.filter(c=>c.table==='homepage_content'&&c.action!=='select').every(c=>c.action==='update'&&c.filters.some(([k,v])=>k==='id'&&v===1)));
  check('No uncaught browser errors',!window.testErrors.length);
  document.body.innerHTML='<pre id="test-results">PASS\n'+results.join('\n')+'</pre>';
}catch(error){document.body.innerHTML='<pre id="test-results">FAIL\n'+error.stack+'\nPassed: '+results.join(', ')+'</pre>';}
