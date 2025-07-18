(function(){
  var script = document.currentScript || (function(){var s=document.getElementsByTagName('script');return s[s.length-1];})();
  var url = new URL(script.src);
  var host = url.origin;
  var bot = url.searchParams.get('bot_name') || '';
  var iframe = document.createElement('iframe');
  iframe.src = host + '/chat?bot_name=' + encodeURIComponent(bot);
  Object.assign(iframe.style, {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    width: '350px',
    height: '500px',
    border: 'none',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    display: 'none',
    zIndex: '2147483647'
  });
  var bubble = document.createElement('div');
  bubble.textContent = 'Chat';
  Object.assign(bubble.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '60px',
    height: '60px',
    borderRadius: '30px',
    background: '#6366f1',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: '2147483647'
  });
  bubble.onclick = function(){
    iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
  };
  document.body.appendChild(iframe);
  document.body.appendChild(bubble);
})();
