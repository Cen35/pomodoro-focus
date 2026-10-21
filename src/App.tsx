import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'focus' | 'break'
type Session = { at: string; minutes: number }
const STATS_KEY = 'focus-moment-stats-v1'
const SETTINGS_KEY = 'focus-moment-settings-v1'
const readJson = <T,>(key:string, fallback:T):T => { try { const value=localStorage.getItem(key); return value?JSON.parse(value):fallback } catch{return fallback} }
const dateKey = (date:Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

export default function App(){
  const settings = readJson(SETTINGS_KEY,{focus:25,break:5})
  const [focusMinutes,setFocusMinutes]=useState(settings.focus)
  const [breakMinutes,setBreakMinutes]=useState(settings.break)
  const [mode,setMode]=useState<Mode>('focus')
  const [seconds,setSeconds]=useState(settings.focus*60)
  const [running,setRunning]=useState(false)
  const [sessions,setSessions]=useState<Session[]>(()=>readJson(STATS_KEY,[]))
  const [message,setMessage]=useState('准备好后，开始你的专注时段。')
  const endAt=useRef<number|null>(null)
  const total=(mode==='focus'?focusMinutes:breakMinutes)*60
  const progress=Math.max(0,Math.min(1,(total-seconds)/total))

  const stats=useMemo(()=>{
    const now=new Date(), today=dateKey(now), start=new Date(now); start.setDate(now.getDate()-((now.getDay()+6)%7)); start.setHours(0,0,0,0)
    return {today:sessions.filter(s=>dateKey(new Date(s.at))===today).length,week:sessions.filter(s=>new Date(s.at)>=start).length,total:sessions.length}
  },[sessions])

  useEffect(()=>{localStorage.setItem(STATS_KEY,JSON.stringify(sessions))},[sessions])
  useEffect(()=>{localStorage.setItem(SETTINGS_KEY,JSON.stringify({focus:focusMinutes,break:breakMinutes}))},[focusMinutes,breakMinutes])
  useEffect(()=>{document.title=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} · ${mode==='focus'?'专注':'休息'}`},[seconds,mode])
  useEffect(()=>{
    if(!running)return
    endAt.current=Date.now()+seconds*1000
    const timer=window.setInterval(()=>{
      const next=Math.max(0,Math.ceil(((endAt.current??Date.now())-Date.now())/1000)); setSeconds(next)
      if(next===0){window.clearInterval(timer); setRunning(false); finish()}
    },250)
    return()=>window.clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[running])

  function tone(){
    try{const AudioCtx=window.AudioContext||(window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;const ctx=new AudioCtx();[0,.25,.5].forEach(delay=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=660;gain.gain.setValueAtTime(.001,ctx.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.18,ctx.currentTime+delay+.02);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+delay+.16);osc.connect(gain).connect(ctx.destination);osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+.18)})}catch{}
  }
  function finish(){
    tone()
    if(mode==='focus'){setSessions(items=>[...items,{at:new Date().toISOString(),minutes:focusMinutes}]);notify('专注完成！','辛苦了，起来活动一下吧。');setMessage('很棒！一个专注时段完成了。');setMode('break');setSeconds(breakMinutes*60)}
    else{notify('休息结束','准备好开启下一轮专注了吗？');setMessage('休息结束，带着清醒的大脑继续吧。');setMode('focus');setSeconds(focusMinutes*60)}
  }
  function notify(title:string,body:string){if('Notification'in window&&Notification.permission==='granted')new Notification(title,{body})}
  async function enableNotice(){
    if(!('Notification'in window)){setMessage('当前浏览器不支持系统通知。');return}
    const result=await Notification.requestPermission();setMessage(result==='granted'?'通知已开启，计时结束会提醒你。':'没有获得通知权限，仍会播放提示音。')
  }
  function switchMode(next:Mode){setRunning(false);setMode(next);setSeconds((next==='focus'?focusMinutes:breakMinutes)*60);setMessage(next==='focus'?'准备专注，先选择一件最重要的事。':'休息一下，去喝口水吧。')}
  function reset(){setRunning(false);setSeconds((mode==='focus'?focusMinutes:breakMinutes)*60);setMessage('计时器已重置。')}
  function skip(){
    const next:Mode=mode==='focus'?'break':'focus'
    setRunning(false);setMode(next);setSeconds((next==='focus'?focusMinutes:breakMinutes)*60);setMessage(next==='focus'?'已跳过休息，准备下一轮专注。':'已跳过本轮，先休息一下吧。')
  }
  function changeDuration(kind:Mode,value:number){const safe=Math.max(1,Math.min(120,value||1));if(kind==='focus'){setFocusMinutes(safe);if(mode==='focus'&&!running)setSeconds(safe*60)}else{setBreakMinutes(safe);if(mode==='break'&&!running)setSeconds(safe*60)}}

  const mm=String(Math.floor(seconds/60)).padStart(2,'0'),ss=String(seconds%60).padStart(2,'0')
  const circumference=2*Math.PI*154, offset=circumference*(1-progress)
  return <main>
    <header><a href="#" className="brand"><span>●</span>专注一刻</a><button className="notice" onClick={enableNotice}>♧ 开启通知</button></header>
    <section className="layout">
      <div className="timer-panel">
        <p className="eyebrow">FOCUS MOMENT</p><h1>一次只做<br/><em>一件事。</em></h1>
        <div className="mode-switch"><button className={mode==='focus'?'active':''} onClick={()=>switchMode('focus')}>专注</button><button className={mode==='break'?'active':''} onClick={()=>switchMode('break')}>休息</button></div>
        <div className="clock" aria-label={`剩余 ${mm} 分 ${ss} 秒`}>
          <svg viewBox="0 0 340 340"><circle className="track" cx="170" cy="170" r="154"/><circle className="progress" cx="170" cy="170" r="154" style={{strokeDasharray:circumference,strokeDashoffset:offset}}/></svg>
          <div><span>{mode==='focus'?'专注时间':'休息时间'}</span><strong>{mm}<i>:</i>{ss}</strong><small>{running?'保持呼吸，专注当下':'静下心，准备开始'}</small></div>
        </div>
        <div className="controls"><button className="secondary" onClick={reset}>↺</button><button className="start" onClick={()=>setRunning(value=>!value)}>{running?'暂停':'开始'}</button><button className="secondary" onClick={skip}>跳过</button></div>
        <p className="message">{message}</p>
      </div>
      <aside>
        <section className="card"><div className="card-title"><div><span>TODAY</span><h2>专注记录</h2></div><strong>{stats.today}</strong></div><div className="stat-grid"><div><b>{stats.week}</b><small>本周完成</small></div><div><b>{stats.total}</b><small>累计完成</small></div><div><b>{sessions.reduce((n,s)=>n+s.minutes,0)}</b><small>累计分钟</small></div></div></section>
        <section className="card settings"><div className="card-title"><div><span>SETTINGS</span><h2>时间设置</h2></div></div><label><span>专注时长<small>分钟</small></span><input type="number" min="1" max="120" value={focusMinutes} onChange={e=>changeDuration('focus',Number(e.target.value))}/></label><label><span>休息时长<small>分钟</small></span><input type="number" min="1" max="60" value={breakMinutes} onChange={e=>changeDuration('break',Number(e.target.value))}/></label><p>修改会在未运行时立即应用；运行中的计时不会被打断。</p></section>
        <blockquote>“你不需要看见整条楼梯，只需迈出第一步。”<cite>— Martin Luther King Jr.</cite></blockquote>
      </aside>
    </section>
    <footer>专注一刻 · 数据仅保存在当前浏览器</footer>
  </main>
}
