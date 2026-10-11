import React,{useState,useRef,useEffect,useCallback,useMemo} from "react";
import {loadCfg,saveCfg,loadHist,saveHist,clearHist,THEMES,SecondChart,ProgressPanel,ComparePanel,HistoryView,DataTable,settingLabel} from "./progress.jsx";

const WB=[...new Set(`the of and a to in is you that it he was for on are as with his they i at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who its now find long down day did get come made may part person year thing man world life hand child woman place work week case point government company group problem fact room mother area money story month lot right study book job business issue side kind head house service friend father power hour game line end member law car city community name team minute idea body information back parent face level office door health art war history party result change morning reason research girl moment air teacher force education light travel garden music ocean forest bridge paper market system program question school student country state fire earth food sea sun moon star sky tree flower animal bird fish mountain river lake island desert field village town street road building window wall floor kitchen phone computer screen keyboard mouse camera table chair desk clock letter language voice sound color shape size weight distance speed weather season spring summer winter evening night dream memory plan goal future past truth hope fear peace freedom justice beauty wisdom courage patience begin become believe bring build carry catch choose clean close cook dance decide deliver design discover draw drive earn enjoy explain explore fall feel fight fix fly follow forget gather grow happen help hold imagine improve increase invite join keep know lead learn leave listen live lose love manage mean meet move need notice offer open order own pass pay perform play prepare press produce promise protect prove provide pull push raise reach read receive record reduce remember remove repeat replace reply report require return run save say search seem sell send serve share show sign sing sit sleep smile solve speak spend stand start stay stop suggest support take talk teach tell think throw touch trust try turn understand visit wait walk want watch wear win wish wonder worry quick brown fox jump lazy dog bright cloud silent gentle rapid distant narrow wide steady fragile simple complex difficult easy important strange normal possible true clear empty full heavy soft hot cold warm cool fast slow early late near far high low big small large tiny strong weak young old new fresh modern ancient common rare public private local global natural real perfect broken safe dangerous happy sad calm brave proud honest careful curious serious funny tired healthy internet network software hardware password account message email browser download update device battery signal wireless digital online server database code function variable interface algorithm engine platform application website backup security`.split(" "))];

const TH={
  night:{bg:"#0D0F14",panel:"#171A21",fg:"#F4F5F7",dim:"#5B6270",mid:"#8890A0",err:"#FF5468",cool:[79,209,197],hot:[255,184,92]},
  paper:{bg:"#F6F3EC",panel:"#E9E4D6",fg:"#1E2229",dim:"#A9A38F",mid:"#6B6757",err:"#D6334B",cool:[30,124,140],hot:[214,120,20]},
  violet:{bg:"#120E1F",panel:"#1C1630",fg:"#F2EEFF",dim:"#5E5483",mid:"#8E83B8",err:"#FF5C8A",cool:[140,120,255],hot:[255,170,90]},
};
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function gen(n,o){const out=[];let last="";for(let i=0;i<n;i++){let w;
  if(o.nums&&Math.random()<.12)w=String(Math.floor(Math.random()*(Math.random()<.5?100:10000)));
  else{do w=rnd(WB);while(w===last);}
  last=w;
  if(o.punct&&!/^\d/.test(w)){if(Math.random()<.15)w=w[0].toUpperCase()+w.slice(1);const r=Math.random();if(r<.1)w+=",";else if(r<.16)w+=".";else if(r<.18)w+="?";}
  out.push(w);}return out;}
const mix=(a,b,h)=>a.map((c,i)=>Math.round(c+(b[i]-c)*h));
const INIT=loadCfg();

const Word=React.memo(function Word({w,t,cur,wi,refs}){
  return <span ref={el=>(refs.current[wi]=el)} style={{whiteSpace:"nowrap"}}>
    {w.split("").map((ch,i)=><span key={i} data-ch style={{color:i<t.length?(t[i]===ch?"var(--fg)":"var(--err)"):(cur?"var(--mid)":"var(--dim)")}}>{ch}</span>)}
    {t.length>w.length&&<span style={{color:"var(--err)"}}>{t.slice(w.length)}</span>}
  </span>;
});

export default function TypingTest(){
  const [cfg,setCfg]=useState(INIT);
  const cfgRef=useRef(INIT);
  const WR=useRef(null); if(!WR.current)WR.current=gen(INIT.mode==="words"?INIT.amount:120,INIT);
  const [words,setWords]=useState(WR.current);
  const S=useRef({typed:[""],index:0});
  const [session,setSession]=useState(S.current);
  const [phase,setPh]=useState("idle");
  const ph=useRef("idle");
  const [elapsed,setElapsed]=useState(0);
  const [result,setResult]=useState(null);
  const [history,setHistory]=useState(loadHist);
  const [tab,setTab]=useState("test");
  const [showTable,setShowTable]=useState(false);
  const [scope,setScope]=useState("setting");
  const [view,setViewS]=useState("test");
  const viewRef=useRef("test");
  const setView=v=>{viewRef.current=v;setViewS(v);};
  const t0=useRef(0),log=useRef([]),ke=useRef({}),cnt=useRef({ok:0,bad:0});
  const hT=useRef(0),hD=useRef(0),lastKey=useRef(0);
  const rootRef=useRef(),wrapRef=useRef(),boxRef=useRef(),caretRef=useRef(),glowRef=useRef(),hotRef=useRef(),wref=useRef([]);
  const th=TH[cfg.theme];
  const {typed,index}=session;

  const reset=useCallback((nc)=>{
    if(nc){cfgRef.current=nc;setCfg(nc);saveCfg(nc);}
    const c=cfgRef.current;
    WR.current=gen(c.mode==="words"?c.amount:120,c);setWords(WR.current);
    S.current={typed:[""],index:0};setSession(S.current);
    ph.current="idle";setPh("idle");setElapsed(0);setResult(null);setTab("test");setShowTable(false);
    log.current=[];ke.current={};cnt.current={ok:0,bad:0};hT.current=0;
  },[]);

  const finish=useCallback(()=>{
    if(ph.current==="done")return;ph.current="done";
    const c=cfgRef.current;
    const el=Math.max(1,c.mode==="time"?c.amount:(performance.now()-t0.current)/1000);
    const {typed:T}=S.current,W=WR.current;
    let good=0,all=T.reduce((s,t)=>s+t.length,0)+T.length-1;
    T.forEach((t,i)=>{if(t===W[i])good+=t.length+(i<T.length-1?1:0);else if(i===T.length-1)for(let j=0;j<t.length;j++)if(t[j]===W[i][j])good++;});
    const n=Math.ceil(el),raw=Array(n).fill(0),errs=Array(n).fill(0);
    log.current.forEach(k=>{const s=Math.min(n-1,Math.floor(k.t/1000));raw[s]++;if(!k.ok)errs[s]++;});
    const series=raw.map(v=>v*12);
    const mean=series.reduce((a,b)=>a+b,0)/n||1,sd=Math.sqrt(series.reduce((a,b)=>a+(b-mean)**2,0)/n);
    const wpm=Math.round(good/5/(el/60)),key="ttw:"+c.mode+c.amount+(c.punct?"p":"")+(c.nums?"n":"");
    let pb=0,isPB=false;
    try{pb=+localStorage.getItem(key)||0;if(wpm>pb){localStorage.setItem(key,wpm);isPB=pb>0;}}catch(e){}
    const {ok,bad}=cnt.current;
    const rawW=Math.round(all/5/(el/60)),accP=Math.round(100*ok/Math.max(1,ok+bad)),consP=Math.max(0,Math.round(100-100*sd/mean));
    const rec={t:Date.now(),wpm,raw:rawW,acc:accP,cons:consP,mode:c.mode,amount:c.amount,punct:c.punct,nums:c.nums,el:Math.round(el)};
    setHistory(h=>{const nh=[...h,rec].slice(-300);saveHist(nh);return nh;});
    setResult({wpm,raw:rawW,acc:accP,cons:consP,ok,bad,series,errs,isPB,pb:Math.max(pb,wpm),keys:{...ke.current},el:Math.round(el),rec});
    setPh("done");
  },[]);

  const heat=useCallback(()=>{
    const now=performance.now()-t0.current;let ok=0;
    for(let i=log.current.length-1;i>=0;i--){const e=log.current[i];if(now-e.t>2200)break;if(e.ok)ok++;}
    hT.current=Math.min(1,ok/5/(2200/60000)/110);lastKey.current=performance.now();
  },[]);

  const onKey=useCallback(e=>{
    const k=e.key,c=cfgRef.current;
    if(k==="Tab"||k==="Escape"){e.preventDefault();setView("test");reset();return;}
    if(viewRef.current==="history")return;
    if(ph.current==="done"){
      if(k==="1")setTab("test");else if(k==="2")setTab("progress");else if(k==="3")setTab("compare");
      else if(k==="t"||k==="T")setShowTable(v=>!v);
      return;
    }
    const typed=S.current.typed.slice();let idx=S.current.index;
    if(k==="Backspace"){
      e.preventDefault();
      // word mode: Backspace = word, Shift+Backspace = one letter. letter mode: Backspace = letter, Ctrl/Alt+Backspace = word.
      const wd=c.bs==="word"?!e.shiftKey:(e.ctrlKey||e.altKey);
      if(typed[idx].length)typed[idx]=wd?"":typed[idx].slice(0,-1);
      else if(idx>0){idx--;typed.pop();if(wd)typed[idx]="";}
    }else if(k===" "){
      e.preventDefault();if(ph.current!=="run"||!typed[idx])return;idx++;typed.push("");
    }else if(k.length===1&&!e.ctrlKey&&!e.metaKey){
      if(ph.current==="idle"){ph.current="run";t0.current=performance.now();setPh("run");}
      const w=WR.current[idx]||"",cur=typed[idx];if(cur.length>=w.length+8)return;
      const ok=w[cur.length]===k;
      if(ok)cnt.current.ok++;else{cnt.current.bad++;const m=(w[cur.length]||k).toLowerCase();ke.current[m]=(ke.current[m]||0)+1;}
      log.current.push({t:performance.now()-t0.current,ok});heat();
      typed[idx]=cur+k;
      if(c.mode==="words"&&idx===WR.current.length-1&&typed[idx].length>=w.length){S.current={typed,index:idx};setSession(S.current);finish();return;}
    }else return;
    S.current={typed,index:idx};setSession(S.current);
    if(c.mode==="time"&&WR.current.length-idx<40){WR.current=[...WR.current,...gen(60,c)];setWords(WR.current);}
  },[reset,finish,heat]);

  useEffect(()=>{window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[onKey]);

  useEffect(()=>{
    if(phase!=="run")return;
    const id=setInterval(()=>{const el=(performance.now()-t0.current)/1000;setElapsed(el);if(cfgRef.current.mode==="time"&&el>=cfgRef.current.amount)finish();},150);
    return()=>clearInterval(id);
  },[phase,finish]);

  // heat animation: refs + direct DOM writes, never React state
  useEffect(()=>{
    let raf;const tick=()=>{
      if(performance.now()-lastKey.current>600)hT.current*=0.97;
      hD.current+=(hT.current-hD.current)*0.08;
      const h=hD.current,t=TH[cfgRef.current.theme],c=`rgb(${mix(t.cool,t.hot,h)})`;
      rootRef.current?.style.setProperty("--hc",c);
      if(glowRef.current)glowRef.current.style.background=`radial-gradient(${55+h*25}% 60% at 50% 40%, rgba(${mix(t.cool,t.hot,h)},${0.1+h*0.38}) 0%, transparent 70%)`;
      if(caretRef.current)caretRef.current.style.boxShadow=`0 0 ${6+h*16}px ${c}`;
      if(hotRef.current)hotRef.current.textContent=Math.round(h*100)+"% hot";
      raf=requestAnimationFrame(tick);
    };raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[]);

  // scroll: keep current line on row 2 of 3; caret from layout offsets (not mid-transition rects)
  useEffect(()=>{
    const el=wref.current[index],wrap=wrapRef.current,caret=caretRef.current;
    if(!el||!wrap||!caret)return;
    const lh=el.offsetHeight||44,ty=Math.max(0,el.offsetTop-lh);
    wrap.style.transform=`translateY(${-ty}px)`;
    const chars=el.querySelectorAll("[data-ch]"),i=typed[index].length;
    let x,y,h;
    if(chars[i]){x=chars[i].offsetLeft;y=chars[i].offsetTop;h=chars[i].offsetHeight;}
    else if(chars.length){const c=chars[chars.length-1];x=c.offsetLeft+c.offsetWidth;y=c.offsetTop;h=c.offsetHeight;}
    else{x=el.offsetLeft;y=el.offsetTop;h=lh;}
    caret.style.transform=`translate(${x}px,${y-ty}px)`;caret.style.height=h+"px";
  },[session,words,phase]);
  useEffect(()=>{document.fonts?.ready.then(()=>setSession({...S.current}));},[]);

  const set=p=>reset({...cfgRef.current,...p});
  const Btn=({on,children,...r})=><button className={"b"+(on?" on":"")} {...r}>{children}</button>;
  const amounts=cfg.mode==="time"?[15,30,60,120]:[10,25,50,100];
  const live=cfg.mode==="time"?Math.max(0,Math.ceil(cfg.amount-elapsed)):`${index}/${cfg.amount}`;
  const running=phase==="run";
  const kb=["qwertyuiop","asdfghjkl","zxcvbnm"];
  const maxErr=result?Math.max(1,...Object.values(result.keys)):1;
  const top=result?Object.entries(result.keys).sort((a,b)=>b[1]-a[1]).slice(0,6):[];

  const dark=cfg.theme!=="paper";
  // chart colours: three categorical slots, validated for contrast and colour-blind separation on every theme surface
  const pal=dark?["#3987e5","#d95926","#199e70"]:["#2a78d6","#eb6834","#1baf7a"];
  const vars={"--grid":dark?"rgba(255,255,255,.09)":"rgba(0,0,0,.12)","--s1":pal[0],"--s2":pal[1],"--s3":pal[2],"--bg":th.bg,"--panel":th.panel,"--fg":th.fg,"--dim":th.dim,"--mid":th.mid,"--err":th.err,"--hc":`rgb(${th.cool})`};
  return <div ref={rootRef} style={{...vars,background:"var(--bg)",color:"var(--fg)",minHeight:"100vh",position:"relative",overflow:"hidden",fontFamily:"'Manrope',system-ui,sans-serif",padding:"36px 20px",display:"flex",justifyContent:"center",WebkitFontSmoothing:"antialiased"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
      *{box-sizing:border-box}.mono{font-family:'JetBrains Mono',monospace}
      .b{background:transparent;border:1px solid transparent;color:var(--mid);padding:6px 11px;border-radius:7px;font:inherit;font-size:13px;cursor:pointer;transition:color .15s,border-color .15s}
      .b:hover{color:var(--fg)}.b.on{color:var(--hc);border-color:var(--hc)}
      .bar{display:flex;flex-wrap:wrap;gap:2px;align-items:center;background:var(--panel);border-radius:10px;padding:4px 6px;transition:opacity .25s}
      .sep{width:1px;height:16px;background:var(--dim);opacity:.4;margin:0 6px}
      .caret{position:absolute;left:0;top:0;width:2px;border-radius:2px;background:var(--hc);transition:transform .08s cubic-bezier(.2,.8,.2,1);pointer-events:none;will-change:transform}
      .card{background:var(--panel);border-radius:12px;padding:14px 18px}
      .lbl{color:var(--dim);font-size:12.5px;padding:0 8px 0 6px}
      .tip{position:absolute;pointer-events:none;z-index:5;background:var(--bg);border:1px solid var(--dim);border-radius:8px;padding:7px 10px;white-space:nowrap;font-size:12.5px;line-height:1.5}
      @media (prefers-reduced-motion:reduce){.caret,.b{transition:none}}`}</style>
    <div ref={glowRef} style={{position:"fixed",inset:0,pointerEvents:"none"}}/>
    <div style={{width:"100%",maxWidth:820,position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
        <div style={{fontWeight:700,fontSize:20,letterSpacing:"-.02em"}}>type<span style={{color:"var(--hc)"}}>heat</span></div>
        <div className="bar" style={{opacity:running?0:1,pointerEvents:running?"none":"auto"}}>
          <Btn on={cfg.punct} onClick={()=>set({punct:!cfg.punct})}>@ punctuation</Btn>
          <Btn on={cfg.nums} onClick={()=>set({nums:!cfg.nums})}># numbers</Btn><span className="sep"/>
          <Btn on={cfg.mode==="time"} onClick={()=>set({mode:"time",amount:30})}>time</Btn>
          <Btn on={cfg.mode==="words"} onClick={()=>set({mode:"words",amount:25})}>words</Btn><span className="sep"/>
          {amounts.map(a=><Btn key={a} on={cfg.amount===a} onClick={()=>set({amount:a})}>{a}</Btn>)}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:36}}>
        <div className="bar" style={{opacity:running?0:1,pointerEvents:running?"none":"auto"}}>
          <span className="lbl">backspace</span>
          <Btn on={cfg.bs==="word"} aria-pressed={cfg.bs==="word"} onClick={()=>set({bs:"word"})} title="Backspace deletes the whole word. Shift+Backspace deletes a single letter.">word</Btn>
          <Btn on={cfg.bs==="letter"} aria-pressed={cfg.bs==="letter"} onClick={()=>set({bs:"letter"})} title="Backspace deletes a single letter. Ctrl or Alt+Backspace deletes a word.">single letter</Btn><span className="sep"/>
          {THEMES.map(t=><Btn key={t} on={cfg.theme===t} onClick={()=>{cfgRef.current={...cfgRef.current,theme:t};setCfg(cfgRef.current);saveCfg(cfgRef.current);}}>{t}</Btn>)}<span className="sep"/>
          <Btn on={view==="history"} aria-pressed={view==="history"} onClick={()=>setView(view==="history"?"test":"history")}>history</Btn>
        </div>
      </div>

      {view==="history"?<HistoryView history={history} cfg={cfg} scope={scope} setScope={setScope} showTable={showTable} setShowTable={setShowTable} onClear={()=>{clearHist();setHistory([]);}} onBack={()=>{setView("test");reset();}}/>:phase!=="done"?<>
        <div className="mono" style={{display:"flex",gap:22,fontSize:15,marginBottom:14,color:"var(--mid)",opacity:running?1:.5,transition:"opacity .25s"}}>
          <span style={{color:"var(--hc)",fontWeight:600}}>{live}</span><span ref={hotRef}>0% hot</span>
        </div>
        <div ref={boxRef} className="mono" style={{position:"relative",height:"5.1em",overflow:"hidden",fontSize:27,lineHeight:1.7,letterSpacing:".3px"}}>
          <div ref={wrapRef} style={{display:"flex",flexWrap:"wrap",gap:"0 .55em",transition:"transform .22s cubic-bezier(.22,.61,.36,1)",willChange:"transform"}}>
            {words.slice(0,index+70).map((w,i)=><Word key={i} wi={i} w={w} t={typed[i]||""} cur={i===index} refs={wref}/>)}
          </div>
          <div ref={caretRef} className="caret"/>
        </div>
        <div style={{marginTop:30,fontSize:12.5,color:"var(--dim)",opacity:running?0:1,transition:"opacity .25s"}}>
          start typing · <b>tab</b> restart · {cfg.bs==="word"?"backspace deletes a word, shift+backspace deletes a single letter":"backspace deletes a single letter, ctrl+backspace a word"}
        </div>
      </>:result&&<div>
        <div style={{display:"flex",gap:18,flexWrap:"wrap",alignItems:"stretch"}}>
          <div className="card" style={{minWidth:170}}>
            <div style={{fontSize:12,color:"var(--mid)"}}>wpm</div>
            <div className="mono" style={{fontSize:68,fontWeight:600,lineHeight:1.05,color:"var(--hc)"}}>{result.wpm}</div>
            <div style={{fontSize:12,color:result.isPB?"var(--hc)":"var(--mid)"}}>{result.isPB?"new personal best":`best ${result.pb}`}</div>
          </div>
          {[["accuracy",result.acc+"%"],["raw",result.raw],["consistency",result.cons+"%"],["chars",<span>{result.ok}<span style={{color:"var(--dim)"}}>/</span><span style={{color:"var(--err)"}}>{result.bad}</span></span>],["time",result.el+"s"]].map(([l,v])=>
            <div key={l} className="card" style={{minWidth:105}}><div style={{fontSize:12,color:"var(--mid)"}}>{l}</div><div className="mono" style={{fontSize:30,fontWeight:600,marginTop:6}}>{v}</div></div>)}
        </div>
        <div className="card" style={{marginTop:18}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:12}}>
            <div style={{display:"flex",gap:2,flexWrap:"wrap"}} role="group" aria-label="Chart view">
              {[["test","this test","1"],["progress","progress","2"],["compare","compare","3"]].map(([k,l,n])=>
                <Btn key={k} on={tab===k} aria-pressed={tab===k} onClick={()=>setTab(k)} title={`Press ${n}`}>{l}</Btn>)}
            </div>
            <Btn on={showTable} aria-pressed={showTable} onClick={()=>setShowTable(v=>!v)} title="Press T">table</Btn>
          </div>
          {tab==="test"&&<div>
            <div style={{fontSize:12.5,color:"var(--mid)",marginBottom:4}}>speed per second (wpm) · red dots = seconds with mistakes</div>
            <SecondChart series={result.series} errs={result.errs}/>
            {showTable&&<DataTable cap="Speed and mistakes for each second of this test" head={["second","wpm","mistakes"]} rows={result.series.map((v,i)=>[i+1,v,result.errs[i]])}/>}
          </div>}
          {tab==="progress"&&<ProgressPanel history={history} cfg={result.rec} scope={scope} setScope={setScope} showTable={showTable}/>}
          {tab==="compare"&&<ComparePanel history={history} result={result} showTable={showTable}/>}
        </div>
        <div className="card" style={{marginTop:18}}>
          <div style={{fontSize:12,color:"var(--mid)",marginBottom:10}}>{top.length?"keys you missed most — brighter = more misses":"no missed keys. clean run."}</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            {kb.map((r,ri)=><div key={r} style={{display:"flex",gap:6,marginLeft:ri*18}}>{r.split("").map(k=>{
              const n=result.keys[k]||0;return <div key={k} className="mono" style={{width:38,height:38,borderRadius:8,display:"grid",placeItems:"center",fontSize:14,
                background:n?`color-mix(in srgb, var(--err) ${25+75*n/maxErr}%, var(--bg))`:"var(--bg)",color:n?"#fff":"var(--dim)"}}>{k}</div>;})}</div>)}
          </div>
          {top.length>0&&<div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center",flexWrap:"wrap"}}>{top.map(([k,n])=><span key={k} className="mono" style={{fontSize:13,color:"var(--mid)"}}><b style={{color:"var(--fg)"}}>{k===" "?"␣":k}</b> ×{n}</span>)}</div>}
        </div>
        <button className="b on" style={{marginTop:22,padding:"10px 20px",fontSize:14}} onClick={()=>reset()}>next test · tab</button>
      </div>}
    </div>
  </div>;
}
