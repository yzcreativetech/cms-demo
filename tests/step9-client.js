import {defaultContent} from '/admin/js/editor-defaults.js';
const copy = value => structuredClone(value);
const fixture = window.top.fixture ||= {
  home: {...copy(defaultContent), announcements: undefined, hero_title:'Saved title'},
  rows: [{...copy(defaultContent.announcements[0]), id:10}],
  next:11, calls:[], fail:null, user:true, uploads:[], objects:{}, uploadFail:null, badUrl:false,
};
export {fixture};
class Query {
  constructor(table) { this.table=table; this.action='select'; this.filters=[]; this.orders=[]; }
  select() { return this; }
  eq(key,value) { this.filters.push([key,value]); return this; }
  order(key) { this.orders.push(key); return this; }
  single() { this.one=true; return this; }
  update(payload) { this.action='update'; this.payload=payload; return this; }
  insert(payload) { this.action='insert'; this.payload=payload; return this; }
  delete() { this.action='delete'; return this; }
  then(resolve,reject) { return this.run().then(resolve,reject); }
  async run() {
    await new Promise(resolve=>setTimeout(resolve,10));
    fixture.calls.push({table:this.table,action:this.action,payload:copy(this.payload),filters:copy(this.filters)});
    const fault=fixture.fail;
    const fails = fault && fault.table===this.table && fault.action===this.action && --fault.after===0;
    if(fails) fixture.fail=null;
    if(fails && !fault.afterWrite) return {error:{message:'fixture rejection'},status:403,data:null};
    if(this.action!=='select' && !fixture.user) return {error:{message:'fixture RLS'},status:403,data:null};
    const isHome=this.table==='homepage_content';
    const all=isHome?(fixture.home?[fixture.home]:[]):fixture.rows;
    let rows=all.filter(row=>this.filters.every(([k,v])=>row[k]===v));
    if(this.action==='update') rows.forEach(row=>Object.assign(row,copy(this.payload),{updated_at:'fixture timestamp'}));
    if(this.action==='insert') {
      if(isHome) throw Error('Forbidden homepage insert');
      const row={...copy(this.payload),id:fixture.next++};fixture.rows.push(row);rows=[row];
    }
    if(this.action==='delete') fixture.rows=fixture.rows.filter(row=>!rows.includes(row));
    rows=[...rows].sort((a,b)=>{for(const key of this.orders){if(a[key]!==b[key])return a[key]<b[key]?-1:1;}return 0;});
    if(fails && fault.afterWrite) return {error:{message:'response lost'},status:0,data:null};
    if(this.one && rows.length!==1) return {error:{message:'Expected one row'},status:406,data:null};
    return {data:copy(this.one?rows[0]:rows),error:null,status:200};
  }
}
export async function getSupabaseClient() {
  return {from:table=>new Query(table), auth:{getUser:async()=>({data:{user:fixture.user?{id:'fixture-admin'}:null},error:null})},
    storage:{from:bucket=>({
      async upload(path,file,options) {
        fixture.uploads.push({bucket,path,file,options});
        await new Promise(resolve=>setTimeout(resolve,10));
        if(!fixture.user || (fixture.uploadFail && --fixture.uploadFail.after===0)) {
          fixture.uploadFail=null;return {error:{message:'private backend error'}};
        }
        if(fixture.objects[path]) return {error:{message:'Duplicate object'}};
        fixture.objects[path]=file;return {data:{path},error:null};
      },
      getPublicUrl(path) { return {data:{publicUrl:fixture.badUrl?'blob:invalid':`${location.origin}/storage/v1/object/public/${bucket}/${path}`}}; },
    })}};
}
