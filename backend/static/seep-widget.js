(function(){
  var s = document.currentScript;
  var mid = s.getAttribute('data-merchant-id') || 'test-merchant';
  var host = new URL(s.src).origin;
  var lang = navigator.language || navigator.userLanguage;
  try { localStorage.setItem('seep-lang', lang); } catch(e) {}

  function css(str){var e=document.createElement('style');e.textContent=str;document.head.appendChild(e);}
  function btn(text,url){var a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.className='seep-btn';return a;}
  function track(ev,details){
    try{fetch(host+'/analytics',{method:'POST',headers:{"Content-Type":"application/json"},body:JSON.stringify({merchantId:mid,event:ev,details:details})});}catch(e){}
  }
  function stripMd(t){return t.replace(/\*\*|\*|_/g,'');}
  function linkify(t){return t.replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank">$1</a>');}
  function smartLinks(t){var l=t.toLowerCase();var b=[];
    if(config.trackLink && /(where is my order|track order)/.test(l)) b.push({text:'Track Order',url:config.trackLink});
    if(config.returnsLink && /(return item|refund policy)/.test(l)) b.push({text:'Return Item',url:config.returnsLink});
    if(config.supportLink && /support/.test(l)) b.push({text:'Contact Support',url:config.supportLink});
    return b;
  }
  var config={};
  var unhelp=0;var pending=null;var m,ta,hint,typing;
  var send;
  function timeGreeting(){var h=new Date().getHours();if(h<12)return 'Good morning';if(h<18)return 'Good afternoon';return 'Good evening';}
  function addMsg(text,type){var d=document.createElement('div');d.className='seep-msg '+type;if(type==='bot'){d.innerHTML=linkify(stripMd(text));}else{d.textContent=text;}m.appendChild(d);m.scrollTop=m.scrollHeight;return d;}
  function handleCommand(t){var l=t.toLowerCase();
    if(/track order/.test(l)){addMsg('Please enter your tracking number or contact support.','bot');return true;}
    if(/view cart/.test(l) && config.cartUrl){addMsg(config.cartUrl,'bot');return true;}
    if(/browse products/.test(l) && Array.isArray(config.popular_links)){
      var links=config.popular_links;var arr=[];for(var i=0;i<links.length;i++){var it=links[i];if(it.url&&it.text)arr.push(it);}showButtons(arr);return arr.length>0;}
    if(/speak to agent/.test(l) && config.support_email){addMsg('Connecting you to support at '+config.support_email,'bot');return true;}
    return false;
  }

  function showButtons(arr){if(!arr||!arr.length)return;var d=document.createElement('div');d.className='seep-msg bot';arr.forEach(function(b){d.appendChild(btn(b.text,b.url));});m.appendChild(d);m.scrollTop=m.scrollHeight;}
  function quickBtn(text){var b=document.createElement('button');b.className='seep-reply';b.textContent=text;b.onclick=function(){ta.value=text;send();};return b;}
  function showQuickReplies(arr){if(!arr||!arr.length)return;var d=document.createElement('div');d.id='seep-quick';arr.forEach(function(t){d.appendChild(quickBtn(t));});m.appendChild(d);m.scrollTop=m.scrollHeight;}
  function showTyping(){if(typing)return;typing=document.createElement('div');typing.className='seep-msg bot typing';typing.innerHTML='<span></span><span></span><span></span>';m.appendChild(typing);m.scrollTop=m.scrollHeight;}
  function hideTyping(){if(typing){typing.remove();typing=null;}}

  function handleBot(text){
    var obj;try{obj=JSON.parse(text);}catch(e){}
    if(obj&&obj.text){text=obj.text;botDiv.innerHTML=linkify(stripMd(text));showButtons(obj.buttons);}else{botDiv.innerHTML=linkify(stripMd(text));}
    var lc=text.toLowerCase();var extra=[];
    if(/go to cart/.test(lc)) extra.push({text:config.cartLabel||'\ud83d\uded2 View Cart',url:'/cart'});
    if(/checkout/.test(lc)) extra.push({text:config.checkoutLabel||'\ud83d\udcb3 Checkout',url:'/checkout'});
    if(extra.length) showButtons(extra);
    if(/don't understand|not sure|sorry/i.test(text)) unhelp++; else unhelp=0;
    if(unhelp>=3 && config.supportLink){
      var d=document.createElement('div');d.className='seep-msg bot';d.textContent='Would you like me to connect you to a human?';d.appendChild(btn('Connect to Support',config.supportLink));m.appendChild(d);unhelp=0;
    }
    if(pending){showButtons(pending);pending=null;}
  }

  var botDiv;
  function init(c){
    config=c||{};
    var color=config.color||'#3b82f6';
      css('#seep-bubble{position:fixed;bottom:20px;right:20px;width:60px;height:60px;border-radius:30px;background:'+color+';color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);z-index:2147483647}'
        +'#seep-container{position:fixed;bottom:90px;right:20px;width:320px;max-width:95vw;height:450px;max-height:70vh;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;z-index:2147483647}'
        +'#seep-header{background:'+color+';color:#fff;padding:10px;font-size:16px}'
        +'#seep-messages{flex:1;overflow-y:auto;padding:10px;font-size:14px;background:#fafafa}'
        +'#seep-input{display:flex;border-top:1px solid #eee}'
        +'#seep-input textarea{flex:1;padding:8px;border:none;resize:none;font-size:14px}'
        +'#seep-input button{background:'+color+';color:#fff;border:none;padding:0 12px;cursor:pointer}'
        +'#seep-actions{display:flex;gap:8px;padding:8px;border-top:1px solid #eee;justify-content:space-around}'
        +'#seep-actions a{flex:1;text-align:center}'
        +'.seep-msg{margin-bottom:8px;padding:8px 12px;border-radius:16px;max-width:80%;line-height:1.4;box-shadow:0 1px 2px rgba(0,0,0,.1);opacity:0;animation:fade-in .3s forwards}'
        +'.seep-msg.bot{background:#f5f7fb;color:#111}'
        +'.seep-msg.user{background:'+color+';color:#fff;margin-left:auto}'
      +'.seep-btn{display:inline-block;margin:4px 4px 0 0;padding:6px 10px;background:'+color+';color:#fff;border-radius:4px;text-decoration:none;cursor:pointer}'
      +'.seep-btn:hover{opacity:.8}'
      +'#seep-hint{font-size:12px;color:#666;padding:4px;display:none}'
      +'.seep-msg.typing{display:flex;gap:4px}'
      +'.seep-msg.typing span{width:6px;height:6px;background:#bbb;border-radius:50%;animation:typing 1s infinite}'
      +'#seep-quick{display:flex;flex-wrap:wrap;margin:4px 0}'
      +'.seep-reply{border:none;background:#eee;border-radius:12px;padding:4px 8px;margin:2px;font-size:12px;cursor:pointer}'
      +'@keyframes typing{0%{transform:translateY(0)}50%{transform:translateY(-4px)}100%{transform:translateY(0)}}'
      +'@keyframes fade-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}');
    var b=document.createElement('div');b.id='seep-bubble';b.innerHTML='Chat';
    var f=document.createElement('div');f.id='seep-container';
    f.innerHTML='<div id="seep-header">Chat</div><div id="seep-messages"></div><div id="seep-input"><textarea rows="1"></textarea><button>Send</button></div><div id="seep-hint">Try asking about shipping, returns, or order status.</div><div id="seep-actions"></div>';
    b.onclick=function(){
      var open=f.style.display!=='flex';
      f.style.display=open?'flex':'none';
      if(open) track('widget_opened');
    };
    document.body.appendChild(b);document.body.appendChild(f);
    m=f.querySelector('#seep-messages');ta=f.querySelector('textarea');var btnEl=f.querySelector('button');hint=f.querySelector('#seep-hint');var actions=f.querySelector('#seep-actions');
    if(c.cartUrl){var cb=btn('\ud83d\uded2 View Cart',c.cartUrl);cb.onclick=function(){track('button_clicked','cart');};actions.appendChild(cb);} 
    if(c.checkoutUrl){var co=btn('\u2705 Checkout',c.checkoutUrl);co.onclick=function(){track('button_clicked','checkout');};actions.appendChild(co);} 
    if(c.contactUrl){var ct=btn('\ud83d\udcac Contact Us',c.contactUrl);ct.onclick=function(){track('button_clicked','contact');};actions.appendChild(ct);} 
    var greet=timeGreeting();var g=c.greeting||c.welcomeMessage;addMsg(greet+(g?'! '+g:'!'),'bot');
    if(Array.isArray(c.quickReplies)) showQuickReplies(c.quickReplies);
    send=function(){var text=ta.value.trim();if(!text)return;track('message_sent');addMsg(text,'user');m.scrollTop=m.scrollHeight;ta.value='';if(handleCommand(text)) return;pending=smartLinks(text);showTyping();
        fetch(host+'/chat',{method:'POST',headers:{"Content-Type":"application/json","x-merchant-id":mid},body:JSON.stringify({message:text})}).then(function(r){if(!r.ok)throw new Error();return r.body.getReader();}).then(function(reader){var dec=new TextDecoder();var bot='';botDiv=null;function read(){reader.read().then(function(res){if(res.done){hideTyping();track('response_received');if(botDiv)handleBot(bot);return;}hideTyping();bot+=dec.decode(res.value,{stream:true});if(botDiv)botDiv.innerHTML=linkify(stripMd(bot));else{botDiv=addMsg(bot,'bot');}m.scrollTop=m.scrollHeight;read();});}read();}).catch(function(){hideTyping();addMsg('Error','bot');});}
    btnEl.onclick=send;
    ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    ta.addEventListener('input',function(){hint.style.display=ta.value.length<5?'block':'none';});
  }

  fetch(host+'/merchant/config/'+encodeURIComponent(mid)).then(function(r){return r.json();}).then(init).catch(function(){init({});});
})();
