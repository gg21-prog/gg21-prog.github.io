(function(){
try{
  var rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
  var cv=document.getElementById('trail'), ctx=cv.getContext('2d');
  var bf=document.getElementById('butterfly'), lens=document.getElementById('lens');
  var fxEl=document.getElementById('fx');
  var branchEl=document.getElementById('branch');
  var hintEl=document.getElementById('perchHint');
  var W=0,H=0,dpr=1;

  function resize(){dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
  addEventListener('resize',resize);resize();

  function rnd(a,b){return a+Math.random()*(b-a);}

  /* ---- Lissajous params ---- */
  var t=0;
  var ph, fxR, fyR, ax, ay, Cx, Cy, Cvx, Cvy;
  var HOME_SPEED=rm?0.005:0.010;
  var OTHER_SPEED=rm?0.006:0.012;

  function initFlight(){
    ph=Math.PI/2 + rnd(-0.12,0.12);
    fxR=1; fyR=2;
    ax=W*rnd(0.40,0.46); ay=H*rnd(0.34,0.40);
    Cx=W/2; Cy=H/2;
    Cvx=rnd(-0.22,0.22)*(rm?0.3:1);
    Cvy=rnd(-0.18,0.18)*(rm?0.3:1);
    t=0; loopCount=0; lastAngle=null; prevSign=null;
    dots=[];
  }
  addEventListener('resize', function(){ if(STATE==='flying') initFlight(); });

  /* ---- state machine ---- */
  var STATE='flying'; // flying | landing | perched
  var LOOPS_TO_LAND=1;
  var loopCount=0, lastAngle=null, prevSign=null;

  /* ---- perch target: centre of branch, just above it ---- */
  function getPerchPos(){
    if(!branchEl) return {x:W/2,y:H/2};
    var r=branchEl.getBoundingClientRect();
    return {x: r.left + (r.right-r.left)*0.45, y: r.top + (r.bottom-r.top)*0.52};
  }

  /* begin a smooth bezier glide onto the centre of the branch */
  function startLanding(){
    STATE='landing';
    landProgress=0;
    landFrom={x:pos.x,y:pos.y};
    landTo=getPerchPos();
    var dist=Math.hypot(landTo.x-landFrom.x, landTo.y-landFrom.y);
    /* C1 continues along the current heading so the curve leaves the flight path smoothly;
       C2 sits above the perch so the butterfly settles down onto the branch */
    var lead=Math.max(70, dist*0.42);
    landC1={x:landFrom.x+Math.cos(heading)*lead, y:landFrom.y+Math.sin(heading)*lead};
    landC2={x:landTo.x, y:landTo.y-Math.max(90, dist*0.5)};
    bf.classList.add('landing');
  }

  var pos={x:W/2, y:H/2}, heading=0;
  var dots=[], lastDot={x:W/2,y:H/2}, DOT_GAP=15, LIFE=rm?2600:5000;
  var landProgress=0;
  var landFrom={x:0,y:0}, landTo={x:0,y:0}, landC1={x:0,y:0}, landC2={x:0,y:0};
  var swayT=0;
  var last=performance.now();

  initFlight();

  /* ---- count loops by watching t cross 2π ---- */
  function checkLoop(newT){
    var angle=(newT*fxR+ph) % (Math.PI*2);
    if(lastAngle===null){lastAngle=angle;return;}
    var crossed=(lastAngle>Math.PI*1.5 && angle<Math.PI*0.5);
    if(crossed) loopCount++;
    lastAngle=angle;
  }

  /* ---- easing ---- */
  function easeInOut(k){return k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;}

  /* ---- cubic bezier helpers (for a smooth, tangent-continuous landing) ---- */
  function bezier(P0,P1,P2,P3,t){
    var u=1-t, uu=u*u, tt=t*t;
    return {x: uu*u*P0.x+3*uu*t*P1.x+3*u*tt*P2.x+tt*t*P3.x,
            y: uu*u*P0.y+3*uu*t*P1.y+3*u*tt*P2.y+tt*t*P3.y};
  }
  function bezierTangent(P0,P1,P2,P3,t){
    var u=1-t;
    return {x: 3*u*u*(P1.x-P0.x)+6*u*t*(P2.x-P1.x)+3*t*t*(P3.x-P2.x),
            y: 3*u*u*(P1.y-P0.y)+6*u*t*(P2.y-P1.y)+3*t*t*(P3.y-P2.y)};
  }

  function step(now){
    var dt=Math.min((now-last)/16.67,2.2); last=now;

    if(STATE==='flying'){
      var speed=currentPage==='home'?HOME_SPEED:OTHER_SPEED;
      t+=speed*dt;
      checkLoop(t);

      /* drift centre */
      Cx+=Cvx*dt; Cy+=Cvy*dt;
      var pad=55;
      if(Cx<ax+pad){Cx=ax+pad;Cvx=Math.abs(Cvx);}
      if(Cx>W-ax-pad){Cx=W-ax-pad;Cvx=-Math.abs(Cvx);}
      if(Cy<ay+pad){Cy=ay+pad;Cvy=Math.abs(Cvy);}
      if(Cy>H-ay-pad){Cy=H-ay-pad;Cvy=-Math.abs(Cvy);}
      if(Math.random()<0.002)Cvx+=rnd(-0.10,0.10);
      if(Math.random()<0.002)Cvy+=rnd(-0.08,0.08);

      var nx=Cx+ax*Math.sin(fxR*t+ph);
      var ny=Cy+ay*Math.sin(fyR*t);
      var hx=nx-pos.x, hy=ny-pos.y;
      var want=Math.atan2(hy,hx);
      var d=Math.atan2(Math.sin(want-heading),Math.cos(want-heading));
      heading+=d*0.22*dt;
      pos.x=nx; pos.y=ny;

      /* start landing after N loops, only on home page */
      if(loopCount>=LOOPS_TO_LAND && currentPage==='home'){
        startLanding();
      }

    } else if(STATE==='landing'){
      landProgress=Math.min(1, landProgress+(rm?0.018:0.008)*dt);
      var e=easeInOut(landProgress);
      var p=bezier(landFrom,landC1,landC2,landTo,e);
      pos.x=p.x; pos.y=p.y;
      /* heading follows the path tangent, eased rather than snapped */
      var tg=bezierTangent(landFrom,landC1,landC2,landTo,e);
      if(tg.x||tg.y){
        var want=Math.atan2(tg.y,tg.x);
        var dh=Math.atan2(Math.sin(want-heading),Math.cos(want-heading));
        heading+=dh*Math.min(1,0.16*dt);
      }

      if(landProgress>=1){
        STATE='perched';
        pos.x=landTo.x; pos.y=landTo.y;
        bf.classList.remove('landing');
        bf.classList.add('perched');
        document.getElementById('bfsway').classList.add('sway');
        bf.style.pointerEvents='auto';
        if(hintEl) hintEl.classList.add('show');
      }

    } else if(STATE==='perched'){
      /* gentle sway in position — CSS handles rotation */
      swayT+=0.012*dt;
      pos.x=landTo.x+Math.sin(swayT)*3;
      pos.y=landTo.y+Math.sin(swayT*0.7)*2;
    }

    var deg=heading*180/Math.PI+90;
    if(STATE==='perched'){
      bf.style.transform='translate3d('+pos.x+'px,'+pos.y+'px,0) rotate(0deg)';
    } else {
      bf.style.transform='translate3d('+pos.x+'px,'+pos.y+'px,0) rotate('+deg+'deg)';
    }
    lens.style.transform='translate3d('+pos.x+'px,'+pos.y+'px,0)';

    /* trail (suppress when perched) */
    if(STATE!=='perched'){
      if(Math.hypot(pos.x-lastDot.x,pos.y-lastDot.y)>=DOT_GAP){
        dots.push({x:pos.x,y:pos.y,t:now});lastDot={x:pos.x,y:pos.y};
      }
    }
    ctx.clearRect(0,0,W,H);
    for(var i=dots.length-1;i>=0;i--){
      var age=now-dots[i].t;
      if(age>LIFE){dots.splice(i,1);continue;}
      var a=(1-age/LIFE)*0.55;
      ctx.beginPath();ctx.arc(dots[i].x,dots[i].y,1.7,0,6.2832);
      ctx.fillStyle='rgba(74,48,33,'+a.toFixed(3)+')';ctx.fill();
    }
    requestAnimationFrame(step);
  }

  /* ---- on phones: no flight, just sit the butterfly on the branch ---- */
  var isPhone=matchMedia('(max-width:640px)').matches;
  function perchStatic(){
    var p=getPerchPos();
    pos.x=p.x; pos.y=p.y; landTo={x:p.x,y:p.y};
    STATE='perched';
    bf.classList.remove('landing'); bf.classList.add('perched');
    bf.style.transform='translate3d('+p.x+'px,'+p.y+'px,0) rotate(0deg)';
    if(lens) lens.style.transform='translate3d('+p.x+'px,'+p.y+'px,0)';
    var sw=document.getElementById('bfsway'); if(sw) sw.classList.add('sway');
    bf.style.pointerEvents='none'; /* no tap-to-restart on mobile */
  }

  if(isPhone){
    perchStatic();
    /* branch height settles after its image loads / on rotation — reposition then */
    addEventListener('load', perchStatic);
    addEventListener('resize', perchStatic);
  } else {
    requestAnimationFrame(step);
  }

  /* ---- click perched butterfly → restart ---- */
  bf.addEventListener('click',function(){
    if(STATE!=='perched') return;
    STATE='flying';
    bf.classList.remove('perched');
    document.getElementById('bfsway').classList.remove('sway');
    bf.style.pointerEvents='none';
    if(hintEl) hintEl.classList.remove('show');
    initFlight();
    pos={x:landTo.x, y:landTo.y};
  });

  /* ---- expose page hook ---- */
  var currentPage='home';
  var fxLayer=document.getElementById('fx');
  window._setBFPage=function(p){
    currentPage=p;
    dots=[];
    fxLayer.style.zIndex=(p==='home')?'5':'0';
    /* phones: butterfly just sits on the branch; re-perch when home returns (it hides behind the panel elsewhere via zIndex) */
    if(isPhone){ if(p==='home') perchStatic(); return; }
    /* if landing/perched and navigating away, keep flying */
    if(p!=='home' && (STATE==='landing'||STATE==='perched')){
      STATE='flying'; bf.classList.remove('perched','landing'); var sw=document.getElementById('bfsway'); if(sw) sw.classList.remove('sway');
      fxLayer.style.pointerEvents='none';
      if(hintEl) hintEl.classList.remove('show');
      initFlight();
    }
  };

}catch(e){console.warn('bf',e);}
})();

/* router */
(function(){try{
  var views=['home','projects','experience'];
  function go(r){
    if(views.indexOf(r)<0)r='home';
    views.forEach(function(v){var el=document.getElementById(v);if(el)el.hidden=(v!==r);});
    var vt=document.getElementById('viewTitle');
    if(vt){ if(r==='home'){vt.hidden=true;} else {vt.textContent=r+'.';vt.hidden=false;} }
    document.querySelectorAll('.navlinks a').forEach(function(a){a.classList.toggle('active',a.dataset.route===r);});
    try{if(location.hash!=='#'+r)history.replaceState(null,'','#'+r);}catch(e){}
    var sc=document.getElementById('scroll');if(sc)sc.scrollTop=0;
    if(window._setBFPage)window._setBFPage(r);
  }
  document.querySelectorAll('[data-route]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();go(a.dataset.route);});});
  var h='home';try{h=(location.hash||'#home').slice(1);}catch(e){}
  go(h);
}catch(e){}})();

/* timeline tracker */
(function(){try{
  var sc=document.getElementById('scroll');
  if(!sc)return;
  function makeTracker(viewId,tlId,iconId){
    var icon=document.getElementById(iconId);
    var stops=document.querySelectorAll('#'+tlId+' .stop');
    if(!icon||!stops.length)return null;
    return function(){
      var tl=document.getElementById(tlId);
      if(!tl||document.getElementById(viewId).hidden)return;
      var scRect=sc.getBoundingClientRect(),activeIdx=0,bestScore=-Infinity;
      stops.forEach(function(s,i){
        var r=s.getBoundingClientRect(),mid=(r.top+r.bottom)/2,viewMid=(scRect.top+scRect.bottom)/2;
        var score=-Math.abs(mid-viewMid);
        if(score>bestScore){bestScore=score;activeIdx=i;}
        s.classList.toggle('active',false);
      });
      /* near the ends the middle-distance metric can't reach the first/last stop — snap to them */
      if(sc.scrollTop+sc.clientHeight>=sc.scrollHeight-4) activeIdx=stops.length-1;
      else if(sc.scrollTop<=2) activeIdx=0;
      stops[activeIdx].classList.add('active');
      var dotRect=stops[activeIdx].querySelector('.stop-dot').getBoundingClientRect();
      icon.style.top=Math.max(0,dotRect.top-tl.getBoundingClientRect().top-17)+'px';
    };
  }
  var trackers=[
    makeTracker('projects','timeline','spineIcon'),
    makeTracker('experience','timelineExp','spineIconExp')
  ].filter(Boolean);
  if(!trackers.length)return;
  function update(){trackers.forEach(function(fn){fn();});}
  sc.addEventListener('scroll',update,{passive:true});
  document.querySelectorAll('[data-route]').forEach(function(a){a.addEventListener('click',function(){setTimeout(update,60);});});
  setTimeout(update,80);
}catch(e){}})();
