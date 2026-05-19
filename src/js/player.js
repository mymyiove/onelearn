const v = document.getElementById("video");
const play = document.getElementById("play");
const fs = document.getElementById("fs");
const rotate = document.getElementById("rotate");
const bar = document.getElementById("bar");
const fill = document.getElementById("fill");
const time = document.getElementById("time");
const vol = document.getElementById("volume");



// 샘플 영상
v.src = "https://www.w3schools.com/html/mov_bbb.mp4";


// 로딩 제거
setTimeout(()=> {
  document.getElementById("loader").style.display="none";
},500);


// ▶ 재생
play.onclick = ()=>{
  if(v.paused) v.play();
  else v.pause();
};


// ▶ 상태
v.onplay = ()=> play.textContent="Ⅱ";
v.onpause = ()=> play.textContent="▶";


// ▶ 시간
v.ontimeupdate = ()=>{
  let c=v.currentTime;
  let d=v.duration||0;

  fill.style.width=(c/d*100)+"%";

  time.textContent =
    format(c)+" / "+format(d);
};

function format(s){
  s=Math.floor(s);
  return String(Math.floor(s/60)).padStart(2,"0")
    +":"+String(s%60).padStart(2,"0");
}


// ▶ 클릭 이동
bar.onclick = e=>{
  let r=bar.getBoundingClientRect();
  let x=(e.clientX-r.left)/r.width;
  v.currentTime=x*v.duration;
};


// ▶ 볼륨
vol.oninput=()=>{
  v.volume=vol.value;
};


// ✅ 전체화면
fs.onclick = ()=>{
  if(!document.fullscreenElement){
    document.querySelector(".player").requestFullscreen();
  }else{
    document.exitFullscreen();
  }
};


// ✅ 더블클릭 풀스크린
document.getElementById("videoWrap").ondblclick=()=>{
  fs.click();
};


// ✅ 모바일만 회전
function isMobile(){
  return window.innerWidth < 768;
}

document.addEventListener("fullscreenchange",()=>{
  if(document.fullscreenElement && isMobile()){
    rotate.style.display="inline-block";
    fs.textContent="⤡";
  }else{
    rotate.style.display="none";
    fs.textContent="⛶";
  }
});


// ✅ 회전
rotate.onclick = async ()=>{
  try{
    if(screen.orientation.type.includes("landscape")){
      await screen.orientation.lock("portrait");
    }else{
      await screen.orientation.lock("landscape");
    }
  }catch(e){
    console.log("회전 불가", e);
  }
};
