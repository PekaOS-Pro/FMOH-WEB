/* FMOH — sitio web público y utilidades compartidas con el editor. Sin librerías externas. */
(function(){
  'use strict';
  const STORAGE='fmoh_site_draft_v1', DB_NAME='fmoh_media_v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=q=>document.querySelector(q);
  const safeLink=v=>{if(!v)return '';try{let u=new URL(v,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const safeAsset=v=>{const s=String(v||'').trim();return ((/^(?:assets\/(?:images|audio|downloads)\/|media\/uploads\/)[a-z0-9_./%() -]+$/i.test(s)&&!s.split('/').includes('..'))||/^https?:\/\/[^\s<>]+$/i.test(s))?s:'assets/images/artista-demo.jpg';};
  const deepClone=x=>JSON.parse(JSON.stringify(x));
  const titleCase=v=>String(v??'').toLocaleLowerCase('es').replace(/(^|\s)([^\p{L}\p{N}]*)([\p{L}\p{N}])/gu,(_,space,punctuation,first)=>space+punctuation+first.toLocaleUpperCase('es'));
  const seed=window.FMOH_DATA||{artist:{name:'FMOH'},albums:[],singles:[]};
  let data=deepClone(seed);
  try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved?.artist&&Array.isArray(saved?.albums)&&Array.isArray(saved?.singles))data=saved;}catch(e){console.warn('El borrador no se pudo cargar',e);}
  if(data.artist.tagline==='HIP HOP DESDE VALPARAÍSO')data.artist.tagline=seed.artist.tagline;
  // Incorporar las nuevas redes a los borradores anteriores del administrador.
  if(seed.socialRevision&&data.socialRevision!==seed.socialRevision){
    for(const key of ['instagram','tiktok','facebook']){
      if(!data.artist[key]&&seed.artist[key])data.artist[key]=seed.artist[key];
    }
    data.socialRevision=seed.socialRevision;
    try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){console.warn('No se pudieron guardar los enlaces de las redes sociales',e);}
  }
  // Incorporar los videos a los borradores anteriores sin reemplazar enlaces editados.
  if(seed.singlesRevision&&data.singlesRevision!==seed.singlesRevision){
    for(const single of data.singles){
      const original=seed.singles.find(s=>s.title===single.title);
      if(!single.link&&original?.link)single.link=original.link;
    }
    data.singlesRevision=seed.singlesRevision;
    try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){console.warn('No se pudieron guardar los enlaces de los sencillos',e);}
  }
  // Actualizar una sola vez los borradores anteriores al catálogo de audio local.
  // Conservar las ediciones y los archivos que ya se hayan asignado desde el panel.
  if(data.catalogRevision!==seed.catalogRevision&&seed.catalogRevision){
    for(const album of data.albums){
      const source=seed.albums.find(a=>a.id===album.id);if(!source)continue;
      for(const track of album.tracks||[]){
        const original=source.tracks.find(t=>titleCase(t.title)===titleCase(track.title));
        if(!track.audio&&original?.audio)track.audio=original.audio;
      }
    }
    for(const id of ['7','ineditos-tracks','los-feos-con-estilo-musical']){
      const album=seed.albums.find(a=>a.id===id);
      if(album&&!data.albums.some(a=>a.id===id)){
        const index=data.albums.findIndex(a=>Number(a.year)<Number(album.year));
        data.albums.splice(index<0?data.albums.length:index,0,deepClone(album));
      }
    }
    data.catalogRevision=seed.catalogRevision;
    try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){console.warn('No se pudo actualizar el borrador',e);}
  }
  // Activar los ZIP locales una sola vez, conservando enlaces de descarga personalizados.
  if(seed.downloadsRevision&&data.downloadsRevision!==seed.downloadsRevision){
    for(const album of data.albums){
      const original=seed.albums.find(a=>a.id===album.id);
      if(!album.downloadUrl&&original?.downloadEnabled){
        for(const key of ['downloadUrl','downloadEnabled','downloadFormat','downloadInfo'])album[key]=original[key];
      }
    }
    data.downloadsRevision=seed.downloadsRevision;
    try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){console.warn('No se pudieron guardar las descargas de los álbumes',e);}
  }
  // Actualizar también los títulos y el origen de los discos guardados en el navegador.
  if(seed.albumTextRevision&&data.albumTextRevision!==seed.albumTextRevision){
    for(const album of data.albums){
      album.location='Villa Alemana, Chile';
      for(const track of album.tracks||[])track.title=titleCase(track.title);
    }
    data.albumTextRevision=seed.albumTextRevision;
    try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){console.warn('No se pudieron guardar los títulos y el origen de los discos',e);}
  }
  // Habilitar la descarga individual también en los borradores anteriores.
  if(seed.trackDownloadsRevision&&data.trackDownloadsRevision!==seed.trackDownloadsRevision){
    for(const album of data.albums)for(const track of album.tracks||[]){
      if(track.audio)track.downloadEnabled=true;
    }
    data.trackDownloadsRevision=seed.trackDownloadsRevision;
    try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){console.warn('No se pudieron guardar las descargas individuales',e);}
  }
  const openDB=()=>new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB no disponible'));return;}const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('media'))r.result.createObjectStore('media');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const mediaCache=new Map();
  async function mediaGet(name){try{const db=await openDB();return await new Promise((resolve,reject)=>{const req=db.transaction('media').objectStore('media').get(name);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}catch{return null;}}
  async function mediaSave(name,file){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('media','readwrite');tx.objectStore('media').put(file,name);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  async function mediaClear(){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('media','readwrite');tx.objectStore('media').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){console.warn(e);}}
  async function resolveMedia(path){const src=safeAsset(path);if(src.startsWith('media/uploads/')){if(mediaCache.has(src))return mediaCache.get(src);let b=await mediaGet(src);if(b){let url=URL.createObjectURL(b);mediaCache.set(src,url);return url;}}return src;}
  function setData(next){data=deepClone(next);try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch(e){toast('El navegador no pudo guardar los datos. Exporta un respaldo.');}window.dispatchEvent(new CustomEvent('fmoh:data-updated'));}
  function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),4000);}
  const link=(text,url)=>safeLink(url)?`<a href="${esc(safeLink(url))}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`:'';
  function albumCard(album){return `<article class="album-card"><a href="album.html?id=${encodeURIComponent(album.id)}" aria-label="Ver álbum ${esc(album.title)}"><div class="album-cover-wrap"><img alt="Carátula provisional de ${esc(album.title)}" data-media="${esc(album.cover)}" src="${esc(safeAsset(album.cover))}" loading="lazy"><div class="album-over"><span>EXPLORAR ÁLBUM ↗</span></div></div><div class="album-card-content"><div class="album-card-top"><span>FMOH / ${esc(album.type||'ÁLBUM')}</span><span>${esc(album.year)}</span></div><h3>${esc(album.title)}</h3><p>${(album.tracks||[]).length?`${album.tracks.length} CANCIONES`:'TRACKLIST POR COMPLETAR'} · HIP HOP / RAP</p></div></a></article>`;}
  async function hydrateMedia(root=document){const nodes=[...root.querySelectorAll('[data-media]')];await Promise.all(nodes.map(async img=>{if(!img.isConnected)return;img.src=await resolveMedia(img.dataset.media);}));}
  function initShared(){const yr=$('#yearNow');if(yr)yr.textContent=new Date().getFullYear();const toggle=$('#menuBtn');if(toggle){toggle.addEventListener('click',()=>{const nav=$('#nav')||$('.nav');let expanded=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',expanded);});}const spotify=$('#navSpotify');if(spotify&&safeLink(data.artist.spotify))spotify.href=safeLink(data.artist.spotify);}
  function renderHome(){const a=data.artist,albums=data.albums||[],singles=data.singles||[];
    $('#heroTitle').textContent=a.name||'FMOH';
    $('#heroTagline').textContent=a.tagline||'';$('#heroEyebrow').textContent=a.eyebrow||'';
    $('#artistBio').textContent=a.bio||'';
    $('#artistQuote').textContent='«'+(a.quote||'Una historia por contar.')+'»';
    $('#artistPhoto').dataset.media=a.photo;$('#heroImage').style.backgroundImage=`url(${JSON.stringify(safeAsset(a.hero))})`;
    resolveMedia(a.hero).then(src=>$('#heroImage').style.backgroundImage=`url(${JSON.stringify(src)})`);
    $('#albumCounter').innerHTML=String(albums.length).padStart(2,'0')+' <span>ÁLBUMES</span>';
    const featured=albums[0];
    $('#heroFeature').innerHTML=featured?`<a href="album.html?id=${encodeURIComponent(featured.id)}"><img alt="Portada de ${esc(featured.title)}" data-media="${esc(featured.cover)}" src="${esc(safeAsset(featured.cover))}"><span>LANZAMIENTO DESTACADO / ${esc(featured.year)}</span><b>${esc(featured.title)} ↗</b></a>`:'';
    const links=[['SPOTIFY',a.spotify],['YOUTUBE',a.youtube],['INSTAGRAM',a.instagram],['TIKTOK',a.tiktok],['FACEBOOK',a.facebook],['CONTACTO',a.email?'mailto:'+a.email:'']];
    $('#socialLinks').innerHTML=links.map(([name,url])=>name==='CONTACTO'&&a.email?`<a href="mailto:${esc(a.email)}">CONTACTO ↗</a>`:link(name,url)).join('');
    $('#bioSpotify').href=safeLink(a.spotify)||'#contacto';
    let filter='albums',term='';
    function draw(){const matches=(row)=>`${row.title} ${row.year}`.toLowerCase().includes(term);let showAlbums=filter!=='singles',showSingles=filter!=='albums';
      $('#albumGrid').hidden=!showAlbums;$('#singlesList').hidden=!showSingles;
      if(showAlbums){let arr=albums.filter(matches);$('#albumGrid').innerHTML=arr.length?arr.map(albumCard).join(''):'<p class="empty-result">No hay álbumes con ese nombre.</p>';hydrateMedia($('#albumGrid'));}
      if(showSingles){let arr=singles.filter(matches);$('#singlesList').innerHTML=arr.length?arr.map((s,i)=>`<div class="single-row"><span class="single-no">${String(i+1).padStart(2,'0')}</span><strong>${esc(s.title)}</strong><span>${esc(s.year)}</span>${safeLink(s.link)?link('ESCUCHAR',s.link):'<span style="text-align:right">SENCILLO</span>'}</div>`).join(''):'<p class="empty-result">No hay sencillos con ese nombre.</p>';}
    }
    document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===el));filter=el.dataset.filter;draw();}));
    $('#searchInput').addEventListener('input',e=>{term=e.target.value.trim().toLowerCase();draw();});draw();hydrateMedia();
  }
  const formatTime=s=>{if(!Number.isFinite(s))return '0:00';let m=Math.floor(s/60),sec=Math.floor(s%60);return `${m}:${String(sec).padStart(2,'0')}`;};
  const isAudioPath=x=>typeof x==='string'&&/^(media\/uploads\/|assets\/audio\/|https?:\/\/)/i.test(x)&&!x.split('/').includes('..');
  let player;
  function initPlayer(){
    const dock=$('#audioDock')||document.createElement('div');
    dock.className='audio-dock';dock.id='audioDock';dock.hidden=true;
    dock.setAttribute('role','region');dock.setAttribute('aria-label','Reproductor de música');
    dock.innerHTML=`<img id="playerCover" src="assets/images/cover-hexiza-force-2.jpg" alt="Carátula"><div class="audio-now"><small>REPRODUCIENDO</small><strong id="playerTitle">SIN REPRODUCCIÓN</strong></div><button class="dock-btn" id="audioPrev" type="button" aria-label="Anterior">◀◀</button><button class="dock-btn big" id="audioPlay" type="button" aria-label="Reproducir">▶</button><button class="dock-btn" id="audioNext" type="button" aria-label="Siguiente">▶▶</button><span id="audioTime" class="audio-time">0:00</span><input type="range" id="audioSeek" min="0" max="1000" value="0" aria-label="Posición de la canción"><span id="audioDuration" class="audio-time">0:00</span><input type="range" id="audioVolume" min="0" max="100" value="80" aria-label="Volumen"><audio id="audioElement" preload="metadata"></audio>`;
    document.body.append(dock);
    const audio=$('#audioElement');
    let playingAlbum=null,current=-1,request=0;
    function sync(){
      const sameAlbum=playingAlbum?.id===document.body.dataset.albumId;
      document.querySelectorAll('.track-row').forEach(row=>row.classList.toggle('playing',sameAlbum&&Number(row.dataset.index)===current));
      document.querySelectorAll('.track-play').forEach(button=>{
        const active=sameAlbum&&Number(button.dataset.play)===current&&!audio.paused;
        button.textContent=active?'Ⅱ':'▶';
        const title=button.closest('.track-row').querySelector('.track-title').textContent;
        button.setAttribute('aria-label',`${active?'Pausar':'Reproducir'} ${title}`);
      });
      $('#audioPlay').textContent=audio.paused?'▶':'Ⅱ';
      $('#audioPlay').setAttribute('aria-label',audio.paused?'Reproducir':'Pausar');
    }
    function toggle(){
      if(current<0)return;
      if(audio.paused)audio.play().catch(()=>toast('No se pudo reanudar el audio.'));
      else audio.pause();
    }
    async function load(album,index){
      const track=album.tracks?.[index];
      if(!track||!isAudioPath(track.audio)){toast('Esta canción todavía no tiene un archivo de audio cargado.');return;}
      const token=++request,src=await resolveMedia(track.audio);
      if(token!==request)return;
      if(!src||src.startsWith('media/uploads/')){toast('Archivo de audio no disponible: revisa la carga.');return;}
      playingAlbum=album;current=index;audio.src=src;dock.hidden=false;
      $('#playerTitle').textContent=track.title;
      $('#playerCover').dataset.media=album.cover;
      resolveMedia(album.cover).then(cover=>{if(token===request)$('#playerCover').src=cover;});
      $('#audioTime').textContent='0:00';$('#audioDuration').textContent='0:00';
      $('#audioSeek').value='0';$('#audioSeek').style.setProperty('--fill','0%');
      sync();
      try{await audio.play();}catch{if(token===request)toast('No fue posible reproducir el audio. Comprueba el archivo o el servidor.');}
      if(token===request)sync();
    }
    function playTrack(album,index){
      if(playingAlbum?.id===album.id&&current===index){toggle();return;}
      return load(album,index);
    }
    function playAlbum(album){
      if(playingAlbum?.id===album.id&&current>=0){toggle();return;}
      const index=(album.tracks||[]).findIndex(track=>isAudioPath(track.audio));
      if(index>=0)return load(album,index);
    }
    function skip(direction){
      const tracks=playingAlbum?.tracks||[];
      for(let i=1;i<=tracks.length;i++){
        const index=(current+direction*i+tracks.length)%tracks.length;
        if(isAudioPath(tracks[index].audio)){load(playingAlbum,index);return;}
      }
    }
    $('#audioPrev').addEventListener('click',()=>skip(-1));
    $('#audioNext').addEventListener('click',()=>skip(1));
    $('#audioPlay').addEventListener('click',toggle);
    audio.addEventListener('play',sync);audio.addEventListener('pause',sync);
    audio.addEventListener('ended',()=>{
      const tracks=playingAlbum?.tracks||[];
      let index=current+1;while(index<tracks.length&&!isAudioPath(tracks[index].audio))index++;
      if(index<tracks.length)load(playingAlbum,index);else sync();
    });
    audio.addEventListener('timeupdate',()=>{
      $('#audioTime').textContent=formatTime(audio.currentTime);
      if(Number.isFinite(audio.duration)&&audio.duration>0){
        $('#audioSeek').value=String(Math.floor(1000*audio.currentTime/audio.duration));
        $('#audioSeek').style.setProperty('--fill',`${Math.floor(100*audio.currentTime/audio.duration)}%`);
      }
    });
    audio.addEventListener('loadedmetadata',()=>$('#audioDuration').textContent=formatTime(audio.duration));
    audio.addEventListener('error',()=>toast('El audio no se encontró. Revisa la ruta del archivo.'));
    $('#audioSeek').addEventListener('input',e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(e.target.value)/1000;});
    $('#audioVolume').addEventListener('input',e=>audio.volume=Number(e.target.value)/100);audio.volume=.8;
    document.addEventListener('keydown',e=>{
      const active=document.activeElement;
      if(!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(active?.tagName)&&!active?.isContentEditable&&!(e.ctrlKey||e.metaKey||e.altKey)&&e.code==='Space'&&current>=0){e.preventDefault();toggle();}
    });
    return {playTrack,playAlbum,sync};
  }
  function renderAlbum(){
    const id=new URLSearchParams(location.search).get('id'), albums=data.albums||[];
    const album=albums.find(a=>a.id===id)||albums[0];
    if(!album){document.querySelector('main').innerHTML='<div class="wrap section"><h1>NO HAY ÁLBUMES TODAVÍA</h1><a href="index.html">Volver al inicio</a></div>';return;}
    const tracks=album.tracks||[];
    document.body.dataset.albumId=album.id;
    const isDownloadPath=x=>typeof x==='string'&&/^(media\/uploads\/|assets\/downloads\/|https?:\/\/)/i.test(x)&&!x.split('/').includes('..');
    const downloadFileName=x=>String(x||'').split('/').pop().split('?')[0]||'descarga';
    const getPlayable=()=>tracks.findIndex(t=>isAudioPath(t.audio));
    const totalSecs=tracks.reduce((n,t)=>{let m=String(t.duration||'').match(/^(\d+):([0-5]\d)$/);return n+(m?Number(m[1])*60+Number(m[2]):0);},0);
    document.title=`${album.title} — ${data.artist.name||'FMOH'}`;
    const shareDescription=`${album.title} · ${data.artist.name||'FMOH'} · ${album.year||''}. Canciones, créditos y enlaces del lanzamiento.`;
    const metaDescription=document.querySelector('meta[name=description]');if(metaDescription)metaDescription.content=shareDescription;
    for(const [property,value] of [['og:title',document.title],['og:description',shareDescription],['og:type','music.album']]){let el=document.querySelector(`meta[property="${property}"]`);if(!el){el=document.createElement('meta');el.setAttribute('property',property);document.head.appendChild(el);}el.content=value;}
    const ld=document.createElement('script');ld.type='application/ld+json';ld.dataset.albumSchema='';ld.textContent=JSON.stringify({'@context':'https://schema.org','@type':'MusicAlbum',name:album.title,byArtist:{'@type':'MusicGroup',name:data.artist.name||'FMOH'},datePublished:album.date||String(album.year||''),genre:album.genre||'Hip-Hop',numTracks:tracks.length,track:tracks.map((t,i)=>({'@type':'MusicRecording',name:t.title,position:i+1}))}).replace(/</g,'\\u003c');document.head.appendChild(ld);
    $('#albumKicker').textContent=`${data.artist.name||'FMOH'} / ${album.type||'ÁLBUM'} / ${album.year||''}`;
    $('#albumTitle').textContent=album.title;
    $('#albumArtist').textContent=data.artist.name||'FMOH';
    $('#albumTeaser').textContent=album.description||'';
    $('#albumCover').dataset.media=album.cover;
    $('#albumYear').textContent=album.year||'—';$('#albumFormat').textContent=album.type||'ÁLBUM';
    $('#albumTrackCount').textContent=String(tracks.length).padStart(2,'0');
    $('#albumTrackCounter').innerHTML=String(tracks.length).padStart(2,'0')+' <span>TEMAS</span>';
    $('#albumQuickMeta').textContent=[album.genre,album.location,album.label?`SELLO: ${album.label}`:'',totalSecs?`DURACIÓN: ${formatTime(totalSecs)}`:''].filter(Boolean).join('  /  ');
    $('#albumDescription').textContent=album.description||'';
    $('#albumCredits').textContent=album.credits||'';
    $('#albumDate').textContent=album.date||album.year||'—';
    const story=$('.album-story'); if(story)story.hidden=![album.description,album.credits,album.label,album.producer].some(x=>String(x||'').trim());
    const creditsSection=$('#albumCredits').previousElementSibling; if(creditsSection)creditsSection.hidden=!String(album.credits||'').trim();
    $('#albumCredits').hidden=!String(album.credits||'').trim();
    $('#extraCredits').innerHTML=[['SELLO DISCOGRÁFICO',album.label],['PRODUCCIÓN',album.producer],['CIUDAD / ORIGEN',album.location],['GÉNERO',album.genre]].filter(([label,val])=>val).map(([label,val])=>`<div><span class="kicker">${label}</span><p class="credits">${esc(val)}</p></div>`).join('');
    $('#albumStreaming').href=safeLink(album.spotify)||safeLink(album.apple)||safeLink(album.bandcamp)||'#plataformas';
    $('#albumPlatforms').innerHTML=[
      link('SPOTIFY',album.spotify),link('APPLE MUSIC',album.apple),
      link('BANDCAMP',album.bandcamp),link('SOUNDCLOUD',album.soundcloud),
      link('YOUTUBE',album.youtube),link('PERFIL SPOTIFY',data.artist.spotify),
    ].filter(Boolean).join('')||'<p class="muted">Próximamente se añadirán los enlaces oficiales.</p>';
    $('#relatedAlbums').innerHTML=albums.filter(x=>x.id!==album.id).slice(0,4).map(albumCard).join('');
    // Insertar un reproductor Spotify solo cuando hay enlace al álbum; no sustituir audio por el enlace del artista.
    const spotifyMatch=String(album.spotify||'').match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]{15,30})/i);
    if(spotifyMatch){
      const frame=document.createElement('iframe');frame.title=`Escuchar ${album.title} en Spotify`;
      frame.src=`https://open.spotify.com/embed/album/${spotifyMatch[1]}`;
      frame.width='100%';frame.height='352';frame.loading='lazy';frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.style.border='0';frame.style.borderRadius='8px';
      $('#spotifyEmbed').replaceChildren(frame);$('#spotifyEmbedBlock').hidden=false;
    }
    // Descargas siempre opt-in: sin enlace o sin autorización no se muestra un botón de descarga engañoso.
    const hasDownload=album.downloadEnabled===true&&isDownloadPath(album.downloadUrl);
    $('#downloadLabel').textContent=album.downloadFormat||'ÁLBUM DIGITAL';
    $('#downloadFormat').textContent=hasDownload?(album.downloadInfo||'Descarga del disco facilitada por el artista.'): 'El enlace aparecerá cuando el artista habilite la descarga.';
    $('#downloadMessage').textContent=hasDownload?'Puedes descargar este lanzamiento desde su enlace oficial.':'La discografía puede escucharse en las plataformas enlazadas; este álbum no tiene descarga pública habilitada.';
    $('#albumRights').textContent=album.rights||'';
    $('#downloadEmpty').hidden=hasDownload;$('#downloadAlbumBtn').hidden=!hasDownload;
    $('#descargas').hidden=!hasDownload;
    $('#albumDownloadTop').hidden=!hasDownload;
    const downloadBtn=$('#downloadAlbumBtn');
    $('#albumDownloadTop').addEventListener('click',()=>document.querySelector('#descargas').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
    if(hasDownload){
      const remote=/^https?:\/\//i.test(album.downloadUrl);
      downloadBtn.href=remote?safeLink(album.downloadUrl):album.downloadUrl;
      if(remote){downloadBtn.target='_blank';downloadBtn.rel='noopener noreferrer';downloadBtn.removeAttribute('download');}
      else{downloadBtn.setAttribute('download',downloadFileName(album.downloadUrl));}
      downloadBtn.addEventListener('click',async ev=>{
        if(!album.downloadUrl.startsWith('media/uploads/'))return;
        ev.preventDefault();const src=await resolveMedia(album.downloadUrl);
        if(!src||src.startsWith('media/uploads/')){toast('No se encontró el archivo local de este disco.');return;}
        const a=document.createElement('a');a.href=src;a.download=downloadFileName(album.downloadUrl);document.body.append(a);a.click();a.remove();
      });
    }
    const uploaded=tracks.filter(t=>isAudioPath(t.audio)).length;
    $('#tracksNote').textContent=tracks.length?(uploaded===tracks.length?'Todas las canciones están disponibles para escuchar aquí.':uploaded?`${uploaded} de ${tracks.length} canciones están disponibles para escuchar aquí.`:'Escucha este lanzamiento desde los enlaces oficiales de las plataformas.'):'Las canciones de este álbum se publicarán próximamente.';
    $('#trackRows').innerHTML=tracks.length?tracks.map((t,i)=>{
      const playable=isAudioPath(t.audio),downloadable=playable&&t.downloadEnabled===true;
      const detail=[t.featuring?`CON ${esc(t.featuring)}`:'',t.producer?`PROD. ${esc(t.producer)}`:''].filter(Boolean).join(' · ');
      return `<div class="track-row" data-index="${i}"><span class="track-no">${String(i+1).padStart(2,'0')}</span><div class="track-info"><strong class="track-title">${esc(t.title||'Sin título')}</strong>${detail?`<small>${detail}</small>`:''}</div><span class="track-length">${esc(t.duration||'—')}</span><div class="track-action">${playable?`<button class="track-play" data-play="${i}" type="button" aria-label="Reproducir ${esc(t.title)}">▶</button>`:'<span class="track-unavailable" title="Audio no disponible en esta web">—</span>'}${downloadable?`<button class="track-download" type="button" data-download-track="${i}" aria-label="Descargar ${esc(t.title)}" title="Descargar canción"><span aria-hidden="true">↓</span> Descargar</button>`:''}</div></div>`;
    }).join(''):'<div class="empty-result">TRACKLIST PENDIENTE DE CARGAR</div>';
    hydrateMedia();
    const playAlbumBtn=$('#playAlbumBtn');if(getPlayable()===-1){const firstLink=safeLink(album.spotify)||safeLink(album.apple)||safeLink(album.bandcamp)||safeLink(album.soundcloud)||safeLink(album.youtube);if(firstLink){playAlbumBtn.textContent='↗ ESCUCHAR EN PLATAFORMAS';playAlbumBtn.addEventListener('click',()=>{window.open(firstLink,'_blank','noopener,noreferrer');});}else{playAlbumBtn.textContent='♫ AUDIO PRÓXIMAMENTE';playAlbumBtn.disabled=true;}}
    if(getPlayable()!==-1)playAlbumBtn.addEventListener('click',()=>player.playAlbum(album));
    $('#shareAlbumBtn').addEventListener('click',async()=>{const href=location.href;try{if(navigator.share)await navigator.share({title:document.title,url:href});else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(href);toast('Enlace del álbum copiado.');}else{prompt('Copia el enlace del álbum:',href);}}catch(e){if(e.name!=='AbortError')toast('No se pudo compartir.');}});
    $('#trackRows').addEventListener('click',async ev=>{
      const play=ev.target.closest('[data-play]');if(play){player.playTrack(album,Number(play.dataset.play));return;}
      const btn=ev.target.closest('[data-download-track]');if(!btn)return;
      const t=tracks[Number(btn.dataset.downloadTrack)];if(!t?.downloadEnabled||!isAudioPath(t.audio))return;
      const src=await resolveMedia(t.audio);if(!src||src.startsWith('media/uploads/')){toast('No se encontró el archivo de audio.');return;}
      const a=document.createElement('a');a.href=src;a.download=downloadFileName(t.audio).replace(/^\d+-[a-z0-9]+\./i,`${String(t.title||'cancion').replace(/[^\w\- ]/g,'').trim()||'cancion'}.`);
      if(/^https?:\/\//i.test(src)&&new URL(src,location.href).origin!==location.origin){a.target='_blank';a.rel='noopener';a.removeAttribute('download');}
      document.body.append(a);a.click();a.remove();
    });
  }
  window.FMOH={getData:()=>deepClone(data),setData,seed:deepClone(seed),mediaGet,mediaSave,mediaClear,resolveMedia,hydrateMedia,esc,toast,STORAGE,DB_NAME};
  function renderCurrentPage(){
    delete document.body.dataset.albumId;
    initShared();
    if(document.body.dataset.page==='home')renderHome();
    if(document.body.dataset.page==='album')renderAlbum();
    player?.sync();
  }
  function initNavigation(){
    // Conservar el documento y el audio; reemplazar únicamente el contenido público.
    const directory=new URL('.',location.href);
    const homePath=new URL('index.html',directory).pathname,albumPath=new URL('album.html',directory).pathname;
    const templates=new Map();
    let renderedRoute=location.pathname+location.search,navigation=0;
    function templatePath(url){return url.pathname===directory.pathname?homePath:url.pathname;}
    function snapshot(doc){
      if(!['home','album'].includes(doc.body.dataset.page))throw Error('Página incompatible');
      const parts=['header','main','footer'].map(selector=>doc.querySelector(selector));
      if(parts.some(part=>!part))throw Error('Página incompleta');
      return {page:doc.body.dataset.page,title:doc.title,description:doc.querySelector('meta[name="description"]')?.content||'',parts:parts.map(part=>part.cloneNode(true))};
    }
    templates.set(templatePath(new URL(location.href)),snapshot(document));
    if('scrollRestoration' in history)history.scrollRestoration='manual';
    function scrollPage(url,position){
      let target;try{target=url.hash&&document.getElementById(decodeURIComponent(url.hash.slice(1)));}catch{}
      if(target)target.scrollIntoView({behavior:'instant'});
      else window.scrollTo({left:position?.[0]||0,top:position?.[1]||0,behavior:'instant'});
    }
    async function navigate(url,push,position){
      const token=++navigation;
      try{
        if(push)history.replaceState({...history.state,fmohScroll:[scrollX,scrollY]},'',location.href);
        const path=templatePath(url);
        if(!templates.has(path)){
          const response=await fetch(new URL(path,location.href),{cache:'no-cache'});
          if(!response.ok)throw Error('Página no disponible');
          templates.set(path,snapshot(new DOMParser().parseFromString(await response.text(),'text/html')));
        }
        if(token!==navigation)return;
        const template=templates.get(path);
        if(push)history.pushState({fmohScroll:[0,0]},'',url.href);
        for(const [index,selector] of ['header','main','footer'].entries())document.querySelector(selector).replaceWith(template.parts[index].cloneNode(true));
        document.body.dataset.page=template.page;
        document.title=template.title;
        const description=document.querySelector('meta[name="description"]');if(description)description.content=template.description;
        document.querySelectorAll('meta[property^="og:"],script[data-album-schema]').forEach(node=>node.remove());
        renderCurrentPage();
        renderedRoute=location.pathname+location.search;
        if(push){const main=document.querySelector('main');main.setAttribute('tabindex','-1');main.focus({preventScroll:true});}
        requestAnimationFrame(()=>{if(token===navigation)scrollPage(url,position);});
      }catch(error){
        if(token===navigation){console.warn('No se pudo navegar sin recargar',error);location.assign(url.href);}
      }
    }
    document.addEventListener('click',event=>{
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const anchor=event.target.closest('a[href]');
      if(!anchor||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
      const url=new URL(anchor.href,location.href),path=templatePath(url);
      if(url.origin!==location.origin||![homePath,albumPath].includes(path))return;
      if(url.pathname===location.pathname&&url.search===location.search){
        if(!url.hash){event.preventDefault();window.scrollTo({top:0,behavior:'instant'});}
        return;
      }
      event.preventDefault();navigate(url,true);
    });
    window.addEventListener('popstate',event=>{
      const url=new URL(location.href);
      if(location.pathname+location.search===renderedRoute){scrollPage(url,event.state?.fmohScroll);return;}
      navigate(url,false,event.state?.fmohScroll);
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(['home','album'].includes(document.body.dataset.page)){
      player=initPlayer();initNavigation();
    }
    renderCurrentPage();
  });
})();
