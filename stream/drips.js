// Ink drips running down from the top edge.
(function(){var n=14;for(var i=0;i<n;i++){var d=document.createElement('div');d.className='drip';
d.style.left=(4+Math.random()*92)+'%';d.style.setProperty('--h',(60+Math.random()*220)+'px');
d.style.width=(6+Math.random()*10)+'px';d.style.animationDelay=(-Math.random()*9)+'s';document.body.appendChild(d);}})();
