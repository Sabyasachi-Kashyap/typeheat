import React,{useState,useRef,useEffect,useCallback} from "react";
import {loadCfg,saveCfg,loadHist,saveHist,clearHist,loadProfile,saveProfile,clearProfile,loadCustom,saveCustom,
  THEMES,MODES,MODE_LABEL,AMOUNTS,LANGS,SIZES,SecondChart,ProgressPanel,ComparePanel,HistoryView,DataTable,sameSetting} from "./progress.jsx";
import {FingerBars,PairList} from "./analysis.jsx";
import {textFor,codeWords,textWords,practiceWords,scoreTest,analyseLog,mergeProfile,weakPairs,MAX_TEXT_WORDS} from "./engine.js";
import {PASSAGES} from "./passages.js";

const TH={
  night:{bg:"#0D0F14",panel:"#171A21",fg:"#F4F5F7",dim:"#5B6270",mid:"#8890A0",err:"#FF5468",cool:[79,209,197],hot:[255,184,92]},
  paper:{bg:"#F6F3EC",panel:"#E9E4D6",fg:"#1E2229",dim:"#A9A38F",mid:"#6B6757",err:"#D6334B",cool:[30,124,140],hot:[214,120,20]},
  violet:{bg:"#120E1F",panel:"#1C1630",fg:"#F2EEFF",dim:"#5E5483",mid:"#8E83B8",err:"#FF5C8A",cool:[140,120,255],hot:[255,170,90]},
};
const DEF_AMOUNT={time:30,words:25,practice:25,code:25,text:0};
const mix=(a,b,h)=>a.map((c,i)=>Math.round(c+(b[i]-c)*h));
const INIT=loadCfg();
const INIT_CUSTOM=loadCustom();
const SENT="​"; // invisible sentinel so a phone's Backspace always has something to delete

// Build the word list for the current mode.
function makeWords(c,custom){
  if(c.mode==="practice")return practiceWords(loadProfile(),c.amount);
  if(c.mode==="code")return codeWords(c.amount,c.lang);
  if(c.mode==="text")return textWords(custom);
  return textFor(c.mode==="words"?c.amount:120,c);
}
// Letter pairs worth a second look in this test: missed most first, then slowest.
function rankPairs(pairs){
  return Object.entries(pairs).filter(([,p])=>p.n>=2)
    .map(([b,p])=>({b,err:p.err,ms:p.msN?Math.round(p.ms/p.msN):0}))
    .filter(x=>x.err>0||x.ms>0)
    .sort((a,b)=>(b.err-a.err)||(b.ms-a.ms))
    .slice(0,6);
}

const Word=React.memo(function Word({w,t,cur,wi,refs}){
  const wrongStyle={textDecoration:"underline",textDecorationThickness:"2px",textUnderlineOffset:"4px"};
  return <span ref={el=>(refs.current[wi]=el)} style={{whiteSpace:"nowrap"}}>
    {w.split("").map((ch,i)=>{
      const wrong=i<t.length&&t[i]!==ch;
      return <span key={i} data-ch style={{color:i<t.length?(wrong?"var(--err)":"var(--fg)"):(cur?"var(--mid)":"var(--dim)"),...(wrong?wrongStyle:null)}}>{ch}</span>;
    })}
    {t.length>w.length&&<span style={{color:"var(--err)",...wrongStyle}}>{t.slice(w.length)}</span>}
  </span>;
});

export default function TypingTest(){
  const [cfg,setCfg]=useState(INIT);
  const cfgRef=useRef(INIT);
  const customRef=useRef(INIT_CUSTOM);
  const [draft,setDraft]=useState(INIT_CUSTOM);
  const WR=useRef(null); if(!WR.current)WR.current=makeWords(INIT,INIT_CUSTOM);
  const [words,setWords]=useState(WR.current);
  const S=useRef({typed:[""],index:0});
  const [session,setSession]=useState(S.current);
  const [phase,setPh]=useState("idle");
  const ph=useRef("idle");
  const [elapsed,setElapsed]=useState(0);
  const [result,setResult]=useState(null);
  const [history,setHistory]=useState(loadHist);
  const [profile,setProfile]=useState(loadProfile);
  const [tab,setTab]=useState("test");
  const [showTable,setShowTable]=useState(false);
  const [scope,setScope]=useState("setting");
  const [view,setViewS]=useState("test");
  const viewRef=useRef("test");
  const setView=v=>{viewRef.current=v;setViewS(v);};
  const t0=useRef(0),log=useRef([]),ke=useRef({}),cnt=useRef({ok:0,bad:0});
  const hT=useRef(0),hD=useRef(0),lastKey=useRef(0);
  const rootRef=useRef(),wrapRef=useRef(),boxRef=useRef(),caretRef=useRef(),glowRef=useRef(),hotRef=useRef(),wref=useRef([]),touchRef=useRef(null);
  const [coarse]=useState(()=>typeof window!=="undefined"&&!!window.matchMedia&&window.matchMedia("(pointer: coarse)").matches);
  const th=TH[cfg.theme];
  const {typed,index}=session;

  const reset=useCallback((nc)=>{
    if(nc){cfgRef.current=nc;setCfg(nc);saveCfg(nc);}
    const c=cfgRef.current;
    WR.current=makeWords(c,customRef.current);setWords(WR.current);
    S.current={typed:[""],index:0};setSession(S.current);
    ph.current="idle";setPh("idle");setElapsed(0);setResult(null);setTab("test");setShowTable(false);
    log.current=[];ke.current={};cnt.current={ok:0,bad:0};hT.current=0;
  },[]);

  const finish=useCallback(()=>{
    if(ph.current==="done")return;ph.current="done";
    const c=cfgRef.current;
    const seconds=c.mode==="time"?c.amount:(performance.now()-t0.current)/1000;
    const W=WR.current,amount=c.mode==="text"?W.length:c.amount;
    const sc=scoreTest({typed:S.current.typed,words:W,seconds,log:log.current});
    const an=analyseLog(log.current);
    const key="ttw:"+c.mode+amount+(c.punct?"p":"")+(c.nums?"n":"")+(c.mode==="code"?c.lang:"");
    let pb=0,isPB=false;
    try{pb=+localStorage.getItem(key)||0;if(sc.wpm>pb){localStorage.setItem(key,sc.wpm);isPB=pb>0;}}catch(e){}
    const {ok,bad}=cnt.current;
    const rec={t:Date.now(),wpm:sc.wpm,raw:sc.raw,acc:sc.acc,cons:sc.cons,mode:c.mode,amount,punct:c.punct,nums:c.nums,lang:c.lang,el:Math.round(sc.el)};
    setHistory(h=>{const nh=[...h,rec].slice(-300);saveHist(nh);return nh;});
    if(log.current.length>=20){const prof=mergeProfile(loadProfile(),an);saveProfile(prof);setProfile(prof);}
    setResult({wpm:sc.wpm,raw:sc.raw,acc:sc.acc,cons:sc.cons,ok,bad,series:sc.series,errs:sc.errs,isPB,pb:Math.max(pb,sc.wpm),
      keys:{...ke.current},el:Math.round(sc.el),rec,fingers:an.fingers,pairs:rankPairs(an.pairs)});
    setPh("done");
  },[]);

  const heat=useCallback(()=>{
    const now=performance.now()-t0.current;let ok=0;
    for(let i=log.current.length-1;i>=0;i--){const e=log.current[i];if(now-e.t>2200)break;if(e.ok)ok++;}
    hT.current=Math.min(1,ok/5/(2200/60000)/110);lastKey.current=performance.now();
  },[]);

  // One key press, from the keyboard or from a phone's text input. `m` holds modifier flags, `pd` prevents default.
  const press=useCallback((k,m,pd)=>{
    const c=cfgRef.current;
    if(k==="Tab"||k==="Escape"){pd();setView("test");reset();return;}
    if(viewRef.current==="history")return;
    if(ph.current==="done"){
      if(k==="1")setTab("test");else if(k==="2")setTab("progress");else if(k==="3")setTab("compare");
      else if(k==="t"||k==="T")setShowTable(v=>!v);
      return;
    }
    if(!WR.current.length)return;
    const typed=S.current.typed.slice();let idx=S.current.index;
    if(k==="Backspace"){
      pd();
      // word mode: Backspace = word, Shift+Backspace = one letter. letter mode: Backspace = letter, Ctrl/Alt+Backspace = word.
      const wd=c.bs==="word"?!m.shiftKey:(m.ctrlKey||m.altKey);
      if(typed[idx].length)typed[idx]=wd?"":typed[idx].slice(0,-1);
      else if(idx>0){idx--;typed.pop();if(wd)typed[idx]="";}
    }else if(k===" "){
      pd();if(ph.current!=="run"||!typed[idx])return;idx++;typed.push("");
    }else if(k.length===1&&!m.ctrlKey&&!m.metaKey){
      if(ph.current==="idle"){ph.current="run";t0.current=performance.now();setPh("run");}
      const w=WR.current[idx]||"",cur=typed[idx];if(cur.length>=w.length+8)return;
      const exp=w[cur.length]||"";
      const ok=exp===k;
      if(ok)cnt.current.ok++;else{cnt.current.bad++;const mm=(exp||k).toLowerCase();ke.current[mm]=(ke.current[mm]||0)+1;}
      const prev=cur.length?w[cur.length-1]:" ";
      log.current.push({t:performance.now()-t0.current,ok,a:exp||k,b:(prev+(exp||k)).toLowerCase()});heat();
      typed[idx]=cur+k;
      if(c.mode!=="time"&&idx===WR.current.length-1&&typed[idx].length>=w.length){S.current={typed,index:idx};setSession(S.current);finish();return;}
    }else return;
    S.current={typed,index:idx};setSession(S.current);
    if(c.mode==="time"&&WR.current.length-idx<40){WR.current=[...WR.current,...textFor(60,c,false)];setWords(WR.current);}
  },[reset,finish,heat]);

  // Keyboard: ignore keys typed into a text box or the phone input (that input is handled by onTouchInput).
  const onWindowKey=useCallback(e=>{
    const t=e.target;
    if(t===touchRef.current)return;
    if(t&&(t.tagName==="TEXTAREA"||t.tagName==="INPUT"))return;
    press(e.key,e,()=>e.preventDefault());
  },[press]);
  useEffect(()=>{window.addEventListener("keydown",onWindowKey);return()=>window.removeEventListener("keydown",onWindowKey);},[onWindowKey]);

  // Phones: characters arrive as input events. The sentinel makes a Backspace visible as a missing character.
  const onTouchInput=useCallback(e=>{
    if(e.nativeEvent&&e.nativeEvent.isComposing)return;
    const el=e.currentTarget,v=el.value;
    if(!v.includes(SENT))press("Backspace",{},()=>{});
    else for(const ch of v.split(SENT).join(""))press(ch,{},()=>{});
    el.value=SENT;
  },[press]);
  const onTouchKey=useCallback(e=>{
    if(e.key==="Tab"||e.key==="Escape")press(e.key,e,()=>e.preventDefault());
  },[press]);

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
  },[session,words,phase,cfg.size,cfg.font]);
  useEffect(()=>{document.fonts?.ready.then(()=>setSession({...S.current}));},[]);

  const set=p=>reset({...cfgRef.current,...p});
  const useText=()=>{customRef.current=draft;saveCustom(draft);setView("test");reset();};
  const Btn=({on,children,...r})=><button className={"b"+(on?" on":"")} {...r}>{children}</button>;
  const amounts=AMOUNTS[cfg.mode]||[];
  const total=words.length;
  const live=cfg.mode==="time"?Math.max(0,Math.ceil(cfg.amount-elapsed)):`${index}/${total}`;
  const running=phase==="run";
  const kb=["qwertyuiop","asdfghjkl","zxcvbnm"];
  const maxErr=result?Math.max(1,...Object.values(result.keys)):1;
  const top=result?Object.entries(result.keys).sort((a,b)=>b[1]-a[1]).slice(0,6):[];
  const weak=cfg.mode==="practice"?weakPairs(profile,5):[];
  const pasted=textWords(draft).length;

  const dark=cfg.theme!=="paper";
  // chart colours: three categorical slots, validated for contrast and colour-blind separation on every theme surface
  const pal=dark?["#3987e5","#d95926","#199e70"]:["#2a78d6","#eb6834","#1baf7a"];
  const vars={"--grid":dark?"rgba(255,255,255,.09)":"rgba(0,0,0,.12)","--s1":pal[0],"--s2":pal[1],"--s3":pal[2],"--bg":th.bg,"--panel":th.panel,"--fg":th.fg,"--dim":th.dim,"--mid":th.mid,"--err":th.err,"--hc":`rgb(${th.cool})`};
  const readable=cfg.font==="readable";
  const hintBs=cfg.bs==="word"?"backspace deletes a word, shift+backspace deletes a single letter":"backspace deletes a single letter, ctrl+backspace a word";
  return <div ref={rootRef} style={{...vars,background:"var(--bg)",color:"var(--fg)",minHeight:"100vh",position:"relative",overflow:"hidden",fontFamily:"'Manrope',system-ui,sans-serif",padding:"24px 20px",display:"flex",justifyContent:"center",WebkitFontSmoothing:"antialiased"}}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=JetBrains+Mono:wght@400;600&family=Atkinson+Hyperlegible:wght@400;700&display=swap');
      *{box-sizing:border-box}.mono{font-family:'JetBrains Mono',monospace}
      .b{background:transparent;border:1px solid transparent;color:var(--mid);padding:6px 11px;border-radius:7px;font:inherit;font-size:13px;cursor:pointer;transition:color .15s,border-color .15s}
      .b:hover{color:var(--fg)}.b.on{color:var(--hc);border-color:var(--hc)}.b:disabled{opacity:.4;cursor:default}
      .bar{display:flex;flex-wrap:wrap;gap:2px;align-items:center;background:var(--panel);border-radius:10px;padding:4px 6px;transition:opacity .25s}
      .sep{width:1px;height:16px;background:var(--dim);opacity:.4;margin:0 6px}
      .caret{position:absolute;left:0;top:0;width:2px;border-radius:2px;background:var(--hc);transition:transform .08s cubic-bezier(.2,.8,.2,1);pointer-events:none;will-change:transform}
      .card{background:var(--panel);border-radius:12px;padding:14px 18px}
      .lbl{color:var(--dim);font-size:12.5px;padding:0 8px 0 6px}
      .tip{position:absolute;pointer-events:none;z-index:5;background:var(--bg);border:1px solid var(--dim);border-radius:8px;padding:7px 10px;white-space:nowrap;font-size:12.5px;line-height:1.5}
      @media (prefers-reduced-motion:reduce){.caret,.b{transition:none}}
      @media (max-width:560px){.bar{justify-content:center}.sep{display:none}}`}</style>
    <div ref={glowRef} style={{position:"fixed",inset:0,pointerEvents:"none"}}/>
    <div style={{width:"100%",maxWidth:1600,position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28,flexWrap:"wrap",gap:10}}>
        <div style={{fontWeight:700,fontSize:20,letterSpacing:"-.02em"}}>type<span style={{color:"var(--hc)"}}>heat</span></div>
        <div className="bar" style={{opacity:running?0:1,pointerEvents:running?"none":"auto"}}>
          {(cfg.mode==="time"||cfg.mode==="words")&&<>
            <Btn on={cfg.punct} onClick={()=>set({punct:!cfg.punct})}>@ punctuation</Btn>
            <Btn on={cfg.nums} onClick={()=>set({nums:!cfg.nums})}># numbers</Btn><span className="sep"/></>}
          {MODES.map(m=><Btn key={m} on={cfg.mode===m} aria-pressed={cfg.mode===m} onClick={()=>set({mode:m,amount:DEF_AMOUNT[m]})}>{MODE_LABEL[m]}</Btn>)}
          {amounts.length>0&&<span className="sep"/>}
          {amounts.map(a=><Btn key={a} on={cfg.amount===a} onClick={()=>set({amount:a})}>{a}</Btn>)}
          {cfg.mode==="code"&&<><span className="sep"/>{Object.entries(LANGS).map(([k,l])=><Btn key={k} on={cfg.lang===k} aria-pressed={cfg.lang===k} onClick={()=>set({lang:k})}>{l}</Btn>)}</>}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
        <div className="bar" style={{opacity:running?0:1,pointerEvents:running?"none":"auto"}}>
          <span className="lbl">backspace</span>
          <Btn on={cfg.bs==="word"} aria-pressed={cfg.bs==="word"} onClick={()=>set({bs:"word"})} title="Backspace deletes the whole word. Shift+Backspace deletes a single letter.">word</Btn>
          <Btn on={cfg.bs==="letter"} aria-pressed={cfg.bs==="letter"} onClick={()=>set({bs:"letter"})} title="Backspace deletes a single letter. Ctrl or Alt+Backspace deletes a word.">single letter</Btn><span className="sep"/>
          {THEMES.map(t=><Btn key={t} on={cfg.theme===t} onClick={()=>{cfgRef.current={...cfgRef.current,theme:t};setCfg(cfgRef.current);saveCfg(cfgRef.current);}}>{t}</Btn>)}<span className="sep"/>
          <Btn on={view==="history"} aria-pressed={view==="history"} onClick={()=>setView(view==="history"?"test":"history")}>history</Btn>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"center",marginBottom:36}}>
        <div className="bar" style={{opacity:running?0:1,pointerEvents:running?"none":"auto"}}>
          <span className="lbl">text</span>
          {Object.entries(SIZES).map(([k,px])=><Btn key={k} on={cfg.size===k} aria-pressed={cfg.size===k} onClick={()=>set({size:k})} title={`${px}px`}>{k==="s"?"small":k==="m"?"medium":"large"}</Btn>)}<span className="sep"/>
          <Btn on={readable} aria-pressed={readable} onClick={()=>set({font:readable?"default":"readable"})} title="Atkinson Hyperlegible, designed to make letters easier to tell apart">readable font</Btn>
        </div>
      </div>

      {view==="history"?<HistoryView history={history} cfg={cfg} scope={scope} setScope={setScope} showTable={showTable} setShowTable={setShowTable} onClear={()=>{clearHist();setHistory([]);clearProfile();setProfile(null);}} onBack={()=>{setView("test");reset();}}/>:phase!=="done"?<>
        {cfg.mode==="text"&&phase==="idle"&&<div className="card" style={{marginBottom:26}}>
          <div style={{fontSize:12.5,color:"var(--mid)",marginBottom:8}}>paste any text, then press "use this text". The first {MAX_TEXT_WORDS} words are used.</div>
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={4} aria-label="Text to type"
            style={{width:"100%",background:"var(--bg)",color:"var(--fg)",border:"1px solid var(--dim)",borderRadius:8,padding:10,font:"inherit",fontSize:14,resize:"vertical"}}/>
          <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap",alignItems:"center"}}>
            <button className="b on" onClick={useText} disabled={!pasted}>use this text</button>
            {PASSAGES.map((p,i)=><button key={i} className="b" onClick={()=>setDraft(p)}>sample {i+1}</button>)}
            <span style={{fontSize:12.5,color:"var(--dim)"}}>{pasted} words</span>
          </div>
        </div>}
        {cfg.mode==="practice"&&phase==="idle"&&<p style={{fontSize:13.5,color:"var(--mid)",margin:"0 0 20px"}}>
          {weak.length?<>practising your weakest letter pairs: {weak.map(x=><b key={x.b} className="mono" style={{color:"var(--fg)",marginRight:8}}>{x.b.replace(/ /g,"␣")}</b>)}</>
            :"Finish a few normal tests first. Practice mode builds words around the letter pairs you miss or type slowly."}
        </p>}
        {words.length>0&&<>
        <div className="mono" style={{display:"flex",gap:22,fontSize:15,marginBottom:14,color:"var(--mid)",opacity:running?1:.5,transition:"opacity .25s"}}>
          <span style={{color:"var(--hc)",fontWeight:600}}>{live}</span><span ref={hotRef}>0% hot</span>
        </div>
        <div ref={boxRef} onClick={()=>touchRef.current?.focus()} className={readable?undefined:"mono"}
          style={{position:"relative",height:"min(50vh,540px)",overflow:"hidden",WebkitMaskImage:"linear-gradient(#000 0%,#000 84%,transparent 100%)",maskImage:"linear-gradient(#000 0%,#000 84%,transparent 100%)",fontSize:SIZES[cfg.size],lineHeight:1.7,letterSpacing:readable?".02em":".3px",fontFamily:readable?"'Atkinson Hyperlegible',system-ui,sans-serif":"'JetBrains Mono',monospace"}}>
          <div ref={wrapRef} style={{display:"flex",flexWrap:"wrap",gap:"0 .55em",transition:"transform .22s cubic-bezier(.22,.61,.36,1)",willChange:"transform"}}>
            {words.slice(0,index+70).map((w,i)=><Word key={i} wi={i} w={w} t={typed[i]||""} cur={i===index} refs={wref}/>)}
          </div>
          <div ref={caretRef} className="caret"/>
        </div>
        {coarse&&<input ref={touchRef} aria-label="Typing input" autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
          defaultValue={SENT} onInput={onTouchInput} onKeyDown={onTouchKey}
          style={{position:"fixed",left:0,bottom:0,width:1,height:1,opacity:0,border:0,padding:0,fontSize:16}}/>}
        <div style={{marginTop:30,fontSize:12.5,color:"var(--dim)",opacity:running?0:1,transition:"opacity .25s"}}>
          {coarse?"tap the text, then type · ":"start typing · "}<b>tab</b> restart · {hintBs}
        </div>
        </>}
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
        <div className="card" style={{marginTop:18}}>
          <div style={{fontSize:12,color:"var(--mid)",marginBottom:12}}>accuracy per finger · this test</div>
          <FingerBars fingers={result.fingers}/>
        </div>
        <div className="card" style={{marginTop:18}}>
          <div style={{fontSize:12,color:"var(--mid)",marginBottom:10}}>letter pairs to work on · most missed first, then slowest (gap = ms before the key)</div>
          <PairList pairs={result.pairs}/>
        </div>
        <div style={{display:"flex",gap:10,marginTop:22,flexWrap:"wrap"}}>
          <button className="b on" style={{padding:"10px 20px",fontSize:14}} onClick={()=>reset()}>next test · tab</button>
          {result.pairs.length>0&&<button className="b" style={{padding:"10px 20px",fontSize:14}} onClick={()=>set({mode:"practice",amount:25})}>practice weak pairs</button>}
        </div>
      </div>}
      <section aria-label="About typeheat" style={{marginTop:36,opacity:running?0:1,transition:"opacity .25s"}}>
        <h2 style={{fontSize:15,color:"var(--fg)",fontWeight:600,margin:"0 0 12px"}}>About typeheat</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,fontSize:14,lineHeight:1.6,color:"var(--mid)"}}>
          <div className="card"><b style={{color:"var(--fg)"}}>Heat</b><p style={{margin:"6px 0 0"}}>A free, minimal typing test. The glow and caret move from teal to amber as you type faster, then fade when you slow down.</p></div>
          <div className="card"><b style={{color:"var(--fg)"}}>Backspace</b><p style={{margin:"6px 0 0"}}>Plain Backspace erases a whole word, so one bad word doesn't cost you your rhythm.</p></div>
          <div className="card"><b style={{color:"var(--fg)"}}>Results</b><p style={{margin:"6px 0 0"}}>WPM, accuracy, consistency, a per-second chart, the keys you miss most, and accuracy for each finger.</p></div>
          <div className="card"><b style={{color:"var(--fg)"}}>Modes</b><p style={{margin:"6px 0 0"}}>Timed and word tests, practice on your weakest letter pairs, code (Python and JavaScript), and text (paste your own).</p></div>
          <div className="card"><b style={{color:"var(--fg)"}}>Privacy</b><p style={{margin:"6px 0 0"}}>Personal bests and progress are saved in your browser. Nothing is sent to a server, and no account is needed.</p></div>
        </div>
      </section>
    </div>
  </div>;
}
