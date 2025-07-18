(function(){
  var s = document.currentScript;
  var mid = s.getAttribute('data-merchant-id') || 'test-merchant';
  var host = new URL(s.src).origin;
  var lang = navigator.language || navigator.userLanguage;
  try { localStorage.setItem('seep-lang', lang); } catch(e) {}

  function css(str){var e=document.createElement('style');e.textContent=str;document.head.appendChild(e);}
  function btn(text,url){var a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.className='seep-btn';return a;}
  function smartLinks(t){var l=t.toLowerCase();var b=[];
    if(config.trackLink && /(where is my order|track order)/.test(l)) b.push({text:'Track Order',url:config.trackLink});
    if(config.returnsLink && /(return item|refund policy)/.test(l)) b.push({text:'Return Item',url:config.returnsLink});
    if(config.supportLink && /support/.test(l)) b.push({text:'Contact Support',url:config.supportLink});
    return b;
  }
  var config={};
  var unhelp=0;var pending=null;var m,ta,hint;

  function showButtons(arr){if(!arr||!arr.length)return;var d=document.createElement('div');d.className='seep-msg bot';arr.forEach(function(b){d.appendChild(btn(b.text,b.url));});m.appendChild(d);m.scrollTop=m.scrollHeight;}

  function handleBot(text){
    var obj;try{obj=JSON.parse(text);}catch(e){}
    if(obj&&obj.text){text=obj.text;botDiv.textContent=text;showButtons(obj.buttons);}else{botDiv.textContent=text;}
    if(/don't understand|not sure|sorry/i.test(text)) unhelp++; else unhelp=0;
    if(unhelp>=3 && config.supportLink){
      var d=document.createElement('div');d.className='seep-msg bot';d.textContent='Would you like me to connect you to a human?';d.appendChild(btn('Connect to Support',config.supportLink));m.appendChild(d);unhelp=0;
    }
    if(pending){showButtons(pending);pending=null;}
  }

  var botDiv;
  function init(c){
    config=c||{};
    css('#seep-bubble{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:30px;background:#3b82f6;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);z-index:2147483647}#seep-container{position:fixed;bottom:90px;right:20px;width:320px;max-width:90vw;height:450px;max-height:70vh;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;z-index:2147483647}#seep-header{background:#3b82f6;color:#fff;padding:10px;font-size:16px}#seep-messages{flex:1;overflow-y:auto;padding:10px;font-size:14px}#seep-input{display:flex;border-top:1px solid #eee}#seep-input textarea{flex:1;padding:8px;border:none;resize:none;font-size:14px}#seep-input button{background:#3b82f6;color:#fff;border:none;padding:0 12px;cursor:pointer}.seep-msg{margin-bottom:8px}.seep-msg.bot{background:#f1f5ff;padding:6px;border-radius:4px}.seep-msg.user{text-align:right}.seep-btn{display:inline-block;margin:4px 4px 0 0;padding:6px 10px;background:#3b82f6;color:#fff;border-radius:4px;text-decoration:none;cursor:pointer}.seep-btn:hover{opacity:.8}#seep-hint{font-size:12px;color:#666;padding:4px;display:none}');
    var b=document.createElement('div');b.id='seep-bubble';b.innerHTML='Chat';
    var f=document.createElement('div');f.id='seep-container';
    f.innerHTML='<div id="seep-header">Chat</div><div id="seep-messages"></div><div id="seep-input"><textarea rows="1"></textarea><button>Send</button></div><div id="seep-hint">Try asking about shipping, returns, or order status.</div>';
    b.onclick=function(){f.style.display=f.style.display==='flex'?'none':'flex';};
    document.body.appendChild(b);document.body.appendChild(f);
    m=f.querySelector('#seep-messages');ta=f.querySelector('textarea');var btnEl=f.querySelector('button');hint=f.querySelector('#seep-hint');
    if(c&&c.welcomeMessage) {var d=document.createElement('div');d.className='seep-msg bot';d.textContent=c.welcomeMessage;m.appendChild(d);}
    function send(){var text=ta.value.trim();if(!text)return;var d=document.createElement('div');d.className='seep-msg user';d.textContent=text;m.appendChild(d);m.scrollTop=m.scrollHeight;pending=smartLinks(text);ta.value='';
      fetch(host+'/chat',{method:'POST',headers:{"Content-Type":"application/json","x-merchant-id":mid},body:JSON.stringify({message:text})}).then(function(r){if(!r.ok)throw new Error();return r.body.getReader();}).then(function(reader){var dec=new TextDecoder();var bot='';botDiv=null;function read(){reader.read().then(function(res){if(res.done){if(botDiv)handleBot(bot);return;}bot+=dec.decode(res.value,{stream:true});if(botDiv)botDiv.textContent=bot;else{botDiv=document.createElement('div');botDiv.className='seep-msg bot';botDiv.textContent=bot;m.appendChild(botDiv);}m.scrollTop=m.scrollHeight;read();});}read();}).catch(function(){var er=document.createElement('div');er.className='seep-msg bot';er.textContent='Error';m.appendChild(er);});}
    btnEl.onclick=send;
    ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    ta.addEventListener('input',function(){hint.style.display=ta.value.length<5?'block':'none';});
  }

  fetch(host+'/merchant/config/'+encodeURIComponent(mid)).then(function(r){return r.json();}).then(init).catch(function(){init({});});
})();
