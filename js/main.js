(function(){
'use strict';
var SB_URL='https://thvpdhayyyfgddzwffzv.supabase.co';
var SB_KEY='sb_publishable_M12fCv3XXGBkqV7iVELxhg_Ez_qaUOJ';
var ADMIN_PWD='CZ12admin2026';
var S={user:null,isAdmin:false,currentWs:null,currentDev:null,cfCb:null,phDevId:null};

function req(tbl,opt){
  opt=opt||{};
  var m=opt.method||'GET',body=opt.body,params=opt.params||{};
  var url=SB_URL+'/rest/v1/'+tbl;
  var q=Object.keys(params).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
  if(q)url+='?'+q;
  var h={'Authorization':'Bearer '+SB_KEY,'apikey':SB_KEY,'Content-Type':'application/json'};
  if(body)h['Prefer']='return=representation';
  return fetch(url,{method:m,headers:h,body:body?JSON.stringify(body):undefined})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d&&typeof d==='object'&&!Array.isArray(d)&&d.items)return d.items;
      if(Array.isArray(d))return d;
      if(d&&typeof d==='object')return[d];
      return[];
    });
}

function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function fmt(s){if(!s)return'';var d=new Date(s);return(d.getMonth()+1)+'月'+d.getDate()+'日';}
function days(s){if(!s)return null;return Math.ceil((new Date(s)-new Date())/(1000*60*60*24));}
function dot(s){return s==='正常'?'dg':s==='维修中'?'do':s==='停用'?'db':'dr';}
function ob(s){return s==='局指'?'oj':s==='一分部'?'oy':'oe';}
function ot(s){return s==='大中型设备'?'ot':'os';}

var tt;
function toast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;t.classList.remove('hidden');
  clearTimeout(tt);tt=setTimeout(function(){t.classList.add('hidden');},2500);
}

function modal(id,show){var e=document.getElementById(id);if(show)e.classList.remove('hidden');else e.classList.add('hidden');}

function showLoginForm(){
  document.getElementById('login-area').classList.remove('hidden');
  document.getElementById('reg-area').classList.add('hidden');
  document.getElementById('pending-area').classList.add('hidden');
}
function showReg(){
  document.getElementById('login-area').classList.add('hidden');
  document.getElementById('reg-area').classList.remove('hidden');
  document.getElementById('pending-area').classList.add('hidden');
}

function handleLogin(e){
  e.preventDefault();
  var email=document.getElementById('li-email').value.trim();
  var pwd=document.getElementById('li-pwd').value;
  if(pwd===ADMIN_PWD){
    S.isAdmin=true;
    S.user={email:email,name:'管理员'};
    localStorage.setItem('cz12_admin','true');
    localStorage.setItem('cz12_user',JSON.stringify(S.user));
    toast('登录成功');
    goHome();return;
  }
  toast('密码错误');
}

function handleReg(e){
  e.preventDefault();
  toast('注册功能暂停，请联系管理员');
}

function doLogout(){
  localStorage.removeItem('cz12_admin');
  localStorage.removeItem('cz12_user');
  location.reload();
}

function checkLogin(){
  if(localStorage.getItem('cz12_admin')==='true'){
    S.isAdmin=true;
    var u=localStorage.getItem('cz12_user');
    S.user=u?JSON.parse(u):{email:'admin',name:'管理员'};
    goHome();return;
  }
  showPage('login');showLoginForm();
}

function goHome(){
  showPage('home');loadStats();loadWsListForHome();updateUserDisplay();
}

function updateUserDisplay(){
  document.getElementById('u-name').textContent=S.isAdmin?'管理员':'用户';
  document.getElementById('u-badge').textContent=S.isAdmin?'管理员':'已登录';
  document.getElementById('fab-ws').style.display=S.isAdmin?'':'none';
}

async function loadStats(){
  var area=document.getElementById('stats-area');
  area.innerHTML='<div class="loading">加载中...</div>';
  try{
    var wss=await req('worksites',{params:{select:'*'}});
    var devs=await req('devices',{params:{select:'*'}});
    var totalWs=wss.length,totalDev=devs.length;
    var normal=devs.filter(function(d){return d.status==='正常';}).length;
    var repair=devs.filter(function(d){return d.status==='维修中';}).length;
    var scrap=devs.filter(function(d){return d.status==='报废'||d.status==='停用';}).length;
    var warn=0,overdue=0;
    for(var i=0;i<devs.length;i++){
      var dv=devs[i];
      if(dv.next_inspection_date){
        var du=days(dv.next_inspection_date);
        if(du!==null&&du<0)overdue++;
        else if(du!==null&&du<=30)warn++;
      }
    }
    var html='<div class="stats-row">'+
      '<div class="stat-card"><div class="stat-num">'+totalWs+'</div><div class="stat-label">工点数</div></div>'+
      '<div class="stat-card"><div class="stat-num">'+totalDev+'</div><div class="stat-label">设备总数</div></div></div>'+
      '<div class="stats-row">'+
      '<div class="stat-card"><div class="stat-num" style="color:#4caf50">'+normal+'</div><div class="stat-label">正常</div></div>'+
      '<div class="stat-card"><div class="stat-num" style="color:#ff9800">'+repair+'</div><div class="stat-label">维修中</div></div>'+
      '<div class="stat-card"><div class="stat-num" style="color:#f44336">'+scrap+'</div><div class="stat-label">停用/报废</div></div></div>';
    if(warn>0||overdue>0){
      html+='<div class="stats-row">';
      if(warn>0)html+='<div class="stat-card"><div class="stat-num" style="color:#e65100">'+warn+'</div><div class="stat-label">30天内到期</div></div>';
      if(overdue>0)html+='<div class="stat-card"><div class="stat-num" style="color:#c62828">'+overdue+'</div><div class="stat-label">已到期</div></div>';
      html+='</div>';
    }
    area.innerHTML=html;
  }catch(e){area.innerHTML='<div class="empty"><div class="empty-icon">X</div><p>加载失败</p></div>';}
}

async function loadWsListForHome(){
  var list=document.getElementById('ws-list');
  list.innerHTML='<div class="loading">加载中...</div>';
  try{
    var wss=await req('worksites',{params:{select:'*,devices(count)',order:'created_at.desc'}});
    if(!wss||wss.length===0){list.innerHTML='<div class="empty"><div class="empty-icon">-</div><p>暂无工点</p></div>';return;}
    var html='';
    for(var i=0;i<wss.length;i++){
      var w=wss[i];
      var cnt=w.devices&&w.devices[0]?w.devices[0].count:0;
      html+='<div class="card" onclick="openWs(&quot;'+w.id+'&quot;,&quot;'+esc(w.name)+'&quot;)">'+
        '<div class="card-head"><div class="card-title">'+esc(w.name)+' <span class="ob '+ob(w.org)+'">'+w.org+'</span></div>'+
        (S.isAdmin?'<div class="card-actions"><button onclick="event.stopPropagation();editWs(&quot;'+w.id+'&quot;,&quot;'+w.org+'&quot;,&quot;'+esc(w.name)+'&quot;)">E</button><button onclick="event.stopPropagation();delWs(&quot;'+w.id+'&quot;,&quot;'+esc(w.name)+'&quot;)">D</button></div>':'')+
        '</div><div class="card-meta">'+(w.location||'')+'</div><div class="card-foot">设备:'+cnt+'台</div></div>';
    }
    list.innerHTML=html;
  }catch(e){list.innerHTML='<div class="empty"><div class="empty-icon">X</div><p>加载失败</p></div>';}
}

function openWs(id,name){
  S.currentWs={id:id,name:name};
  document.getElementById('ws-title2').textContent=name;
  showPage('ws');loadWsDevs();
}

function refreshAll(){goHome();}

function showAddWs(){
  S.currentWs=null;
  document.getElementById('m-ws-title').textContent='添加工点';
  document.getElementById('wsf-id').value='';
  document.getElementById('wsf-org').value='局指';
  document.getElementById('wsf-name').value='';
  document.getElementById('wsf-loc').value='';
  document.getElementById('wsf-note').value='';
  modal('m-ws',true);
}
window.showAddWs=showAddWs;

function editWs(id,org,name){
  document.getElementById('m-ws-title').textContent='编辑工点';
  document.getElementById('wsf-id').value=id;
  document.getElementById('wsf-org').value=org;
  document.getElementById('wsf-name').value=name;
  modal('m-ws',true);
}
window.editWs=editWs;

async function saveWs(e){
  e.preventDefault();
  var id=document.getElementById('wsf-id').value;
  var org=document.getElementById('wsf-org').value;
  var name=document.getElementById('wsf-name').value.trim();
  var loc=document.getElementById('wsf-loc').value.trim();
  var note=document.getElementById('wsf-note').value.trim();
  if(!name){toast('请输入名称');return;}
  try{
    if(id){
      await req('worksites?id=eq.'+id,{method:'PATCH',body:{org:org,name:name,location:loc,note:note}});
      toast('更新成功');
    }else{
      await req('worksites',{method:'POST',body:{org:org,name:name,location:loc,note:note,created_by:'00000000-0000-0000-0000-000000000000'}});
      toast('添加成功');
    }
    modal('m-ws',false);loadWsListForHome();
  }catch(err){toast('保存失败: '+err.message);}
}
window.saveWs=saveWs;

function delWs(id,name){
  confirm('删除工点「'+name+'」？',async function(){
    try{await req('worksites?id=eq.'+id,{method:'DELETE'});toast('已删除');loadWsListForHome();}catch(e){toast('删除失败');}
  });
}
window.delWs=delWs;

async function loadWsDevs(){
  var list=document.getElementById('ws-dev-list');
  list.innerHTML='<div class="loading">加载中...</div>';
  if(!S.currentWs)return;
  try{
    var typeF=document.getElementById('f-dev-type').value;
    var statusF=document.getElementById('f-dev-status').value;
    var searchF=document.getElementById('f-dev-search').value.trim().toLowerCase();
    var devs=await req('devices',{params:{select:'*,photos(count)',eq_worksite_id:S.currentWs.id,order:'created_at.desc'}});
    if(typeF)devs=devs.filter(function(d){return d.device_type===typeF;});
    if(statusF)devs=devs.filter(function(d){return d.status===statusF;});
    if(searchF)devs=devs.filter(function(d){return(d.name+(d.model||'')+(d.serial_number||'')).toLowerCase().indexOf(searchF)!==-1;});
    if(!devs||devs.length===0){list.innerHTML='<div class="empty"><div class="empty-icon">-</div><p>'+(typeF||statusF||searchF?'无筛选结果':'暂无设备')+'</p></div>';return;}
    var html='';
    for(var i=0;i<devs.length;i++){
      var d=devs[i];
      var cnt=d.photos&&d.photos[0]?d.photos[0].count:0;
      var warn='';
      if(d.next_inspection_date){
        var du=days(d.next_inspection_date);
        if(du!==null&&du<0)warn='error-card';
        else if(du!==null&&du<=30)warn='warn-card';
      }
      html+='<div class="card '+warn+'" onclick="openDev(&quot;'+d.id+'&quot;)">'+
        '<div class="card-head"><div class="card-title">'+esc(d.name)+' <span class="ot '+ot(d.device_type)+'">'+d.device_type+'</span></div>'+
        (S.isAdmin?'<div class="card-actions"><button onclick="event.stopPropagation();editDevById(&quot;'+d.id+'&quot;)">E</button><button onclick="event.stopPropagation();delDevById(&quot;'+d.id+'&quot;,&quot;'+esc(d.name)+'&quot;)">D</button></div>':'')+
        '</div><div class="card-meta"><span class="dot '+dot(d.status)+'"></span>'+d.status+(d.model?' · '+esc(d.model):'')+'</div>'+
        '<div class="card-foot">照片:'+cnt+'张 · '+fmt(d.created_at)+'</div></div>';
    }
    list.innerHTML=html;
  }catch(e){list.innerHTML='<div class="empty"><div class="empty-icon">X</div><p>加载失败</p></div>';}
}

function refreshWsDevs(){loadWsDevs();}

async function showAddDev(){
  document.getElementById('m-dev-title').textContent='添加设备';
  document.getElementById('df-id').value='';
  var wsSel=document.getElementById('df-ws');
  var wss=await req('worksites',{params:{select:'id,name',order:'name.asc'}});
  wsSel.innerHTML=wss.map(function(w){return '<option value="'+w.id+'">'+esc(w.name)+'</option>';}).join('');
  if(S.currentWs)wsSel.value=S.currentWs.id;
  document.getElementById('df-name').value='';
  document.getElementById('df-type').value='大中型设备';
  document.getElementById('df-status').value='正常';
  document.getElementById('df-model').value='';
  document.getElementById('df-serial').value='';
  document.getElementById('df-mfr').value='';
  document.getElementById('df-mfg').value='';
  document.getElementById('df-pur').value='';
  document.getElementById('df-desc').value='';
  modal('m-dev',true);
}
window.showAddDev=showAddDev;

async function editDevById(id){
  var devs=await req('devices',{params:{id:'eq.'+id,select:'*',limit:1}});
  if(!devs||!devs[0]){toast('加载失败');return;}
  var d=devs[0];
  document.getElementById('m-dev-title').textContent='编辑设备';
  document.getElementById('df-id').value=id;
  var wsSel=document.getElementById('df-ws');
  var wss=await req('worksites',{params:{select:'id,name',order:'name.asc'}});
  wsSel.innerHTML=wss.map(function(w){return '<option value="'+w.id+'">'+esc(w.name)+'</option>';}).join('');
  wsSel.value=d.worksite_id;
  document.getElementById('df-name').value=d.name||'';
  document.getElementById('df-type').value=d.device_type||'大中型设备';
  document.getElementById('df-status').value=d.status||'正常';
  document.getElementById('df-model').value=d.model||'';
  document.getElementById('df-serial').value=d.serial_number||'';
  document.getElementById('df-mfr').value=d.manufacturer||'';
  document.getElementById('df-mfg').value=d.mfg_date||'';
  document.getElementById('df-pur').value=d.purchase_date||'';
  document.getElementById('df-desc').value=d.description||'';
  modal('m-dev',true);
}
window.editDevById=editDevById;

async function saveDev(e){
  e.preventDefault();
  var id=document.getElementById('df-id').value;
  var worksite_id=document.getElementById('df-ws').value;
  var name=document.getElementById('df-name').value.trim();
  var device_type=document.getElementById('df-type').value;
  var status=document.getElementById('df-status').value;
  var model=document.getElementById('df-model').value.trim();
  var serial_number=document.getElementById('df-serial').value.trim();
  var manufacturer=document.getElementById('df-mfr').value.trim();
  var mfg_date=document.getElementById('df-mfg').value;
  var purchase_date=document.getElementById('df-pur').value;
  var description=document.getElementById('df-desc').value.trim();
  if(!name){toast('请输入名称');return;}
  var body={worksite_id:worksite_id,name:name,device_type:device_type,status:status,model:model,serial_number:serial_number,manufacturer:manufacturer,description:description};
  if(mfg_date)body.mfg_date=mfg_date;
  if(purchase_date)body.purchase_date=purchase_date;
  try{
    if(id){
      await req('devices?id=eq.'+id,{method:'PATCH',body:body});
      toast('更新成功');
    }else{
      body.created_by='00000000-0000-0000-0000-000000000000';
      await req('devices',{method:'POST',body:body});
      toast('添加成功');
    }
    modal('m-dev',false);loadWsDevs();
  }catch(err){toast('保存失败: '+err.message);}
}
window.saveDev=saveDev;

function delDevById(id,name){
  confirm('删除设备「'+name+'」？',async function(){
    try{await req('devices?id=eq.'+id,{method:'DELETE'});toast('已删除');loadWsDevs();}catch(e){toast('删除失败');}
  });
}
window.delDevById=delDevById;

async function openDev(id){
  S.currentDev={id:id};
  document.getElementById('dev-back').onclick=function(){showPage('ws');};
  var devs=await req('devices',{params:{id:'eq.'+id,select:'*',limit:1}});
  if(!devs||!devs[0]){document.getElementById('dev-detail').innerHTML='<div class="empty"><div class="empty-icon">X</div><p>加载失败</p></div>';return;}
  var d=devs[0];
  document.getElementById('dev-title2').textContent=d.name;
  var photos=await req('photos',{params:{eq_device_id:id,select:'*',order:'created_at.desc'}});
  var phHtml='';
  if(photos&&photos.length>0){
    phHtml='<div class="sec-title">照片 ('+photos.length+')</div><div class="pgrid">';
    for(var i=0;i<photos.length;i++){
      phHtml+='<div class="pitem"><img src="'+esc(photos[i].url)+'" onclick="window.open(&quot;'+esc(photos[i].url)+'&quot;)">'+
        (S.isAdmin?'<button class="pdel" onclick="delPhoto(&quot;'+photos[i].id+'&quot;)">x</button>':'')+'</div>';
    }
    phHtml+='</div>';
  }
  var html='<div class="card"><div class="card-title">'+esc(d.name)+' <span class="ot '+ot(d.device_type)+'">'+d.device_type+'</span></div>'+
    '<div class="card-meta"><span class="dot '+dot(d.status)+'"></span>'+d.status+'</div>'+
    (d.model?'<div class="card-meta">型号: '+esc(d.model)+'</div>':'')+
    (d.serial_number?'<div class="card-meta">编号: '+esc(d.serial_number)+'</div>':'')+
    (d.manufacturer?'<div class="card-meta">厂家: '+esc(d.manufacturer)+'</div>':'')+
    (d.description?'<div class="card-desc">'+esc(d.description)+'</div>':'')+
    '</div>'+
    '<div class="mt8"><button class="btn btn-sm" onclick="openPhotoModal(&quot;'+id+'&quot;,&quot;'+esc(d.name)+'&quot;)">照片管理</button></div>'+
    phHtml;
  document.getElementById('dev-detail').innerHTML=html;
  showPage('dev');
}
window.openDev=openDev;

async function openPhotoModal(devId,devName){
  S.phDevId=devId;
  document.getElementById('ph-dev-name').textContent=devName;
  var grid=document.getElementById('ph-grid');
  try{
    var photos=await req('photos',{params:{eq_device_id:devId,select:'*',order:'created_at.desc'}});
    if(!photos||photos.length===0){grid.innerHTML='<div class="empty" style="padding:20px">暂无照片</div>';}
    else{
      grid.innerHTML=photos.map(function(p){
        return '<div class="pitem"><img src="'+esc(p.url)+'" onclick="window.open(&quot;'+esc(p.url)+'&quot;)">'+
          (S.isAdmin?'<button class="pdel" onclick="delPhoto(&quot;'+p.id+'&quot;)">x</button>':'')+'</div>';
      }).join('');
    }
  }catch(e){grid.innerHTML='<div class="empty" style="padding:20px">加载失败</div>';}
  modal('m-photo',true);
}
window.openPhotoModal=openPhotoModal;

function doPhotoUpload(){document.getElementById('ph-input').click();}

function handlePhUpload(e){
  var files=e.target.files;
  if(!files||files.length===0)return;
  var devId=S.phDevId;
  var grid=document.getElementById('ph-grid');
  grid.innerHTML='<div class="loading">上传中...</div>';
  var reader=new FileReader();
  reader.onload=function(ev){
    var dataUrl=ev.target.result;
    req('photos',{method:'POST',body:{device_id:devId,url:dataUrl,created_by:'00000000-0000-0000-0000-000000000000'}})
      .then(function(){toast('上传成功');openPhotoModal(devId,document.getElementById('ph-dev-name').textContent);})
      .catch(function(){toast('上传失败');});
  };
  reader.readAsDataURL(files[0]);
}
window.handlePhUpload=handlePhUpload;

function delPhoto(id){
  confirm('删除照片？',async function(){
    try{await req('photos?id=eq.'+id,{method:'DELETE'});toast('已删除');openPhotoModal(S.phDevId,document.getElementById('ph-dev-name').textContent);}catch(e){toast('删除失败');}
  });
}
window.delPhoto=delPhoto;

function editDev(){if(S.currentDev)editDevById(S.currentDev.id);}

async function doExport(){
  try{
    var wss=await req('worksites',{params:{select:'*',order:'org.asc,name.asc'}});
    var html='<table border="1" style="border-collapse:collapse;font-size:11px">';
    html+='<tr style="background:#1565C0;color:#fff"><th>序号</th><th>单位</th><th>工点</th><th>设备名称</th><th>类别</th><th>状态</th><th>型号</th><th>编号</th><th>厂家</th><th>描述</th></tr>';
    var row=1;
    for(var i=0;i<wss.length;i++){
      var ws=wss[i];
      var devs=await req('devices',{params:{eq_worksite_id:ws.id,select:'*',order:'name.asc'}});
      if(!devs||devs.length===0){
        html+='<tr><td>'+row+++'</td><td>'+esc(ws.org)+'</td><td>'+esc(ws.name)+'</td><td colspan="7" style="color:#999">无设备</td></tr>';
      }else{
        for(var j=0;j<devs.length;j++){
          var d=devs[j];
          html+='<tr><td>'+row+++'</td><td>'+esc(ws.org)+'</td><td>'+esc(ws.name)+'</td><td>'+esc(d.name)+'</td><td>'+esc(d.device_type)+'</td><td>'+esc(d.status)+'</td><td>'+esc(d.model||'')+'</td><td>'+esc(d.serial_number||'')+'</td><td>'+esc(d.manufacturer||'')+'</td><td>'+esc(d.description||'')+'</td></tr>';
        }
      }
    }
    html+='</table>';
    var blob=new Blob([html],{type:'application/vnd.ms-excel'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='CZ12设备清单_'+new Date().toISOString().slice(0,10)+'.xls';
    a.click();
    toast('导出成功');
  }catch(e){toast('导出失败');}
}
window.doExport=doExport;

function showUser(){
  document.getElementById('uinfo').innerHTML='<strong>管理员账户</strong><br><span class="cg">'+S.user.email+'</span>';
  modal('m-user',true);
}
window.showUser=showUser;

function confirm(msg,cb){
  document.getElementById('cf-msg').textContent=msg;
  S.cfCb=cb;
  modal('m-confirm',true);
}
window.confirm=confirm;

function doCf(){
  modal('m-confirm',false);
  if(S.cfCb)S.cfCb();
}
window.doCf=doCf;

function showPage(id){
  var pages=document.querySelectorAll('.page');
  for(var i=0;i<pages.length;i++)pages[i].classList.remove('active');
  document.getElementById('page-'+id).classList.add('active');
  window.scrollTo(0,0);
}

document.addEventListener('DOMContentLoaded',checkLogin);
})();