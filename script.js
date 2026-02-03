const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let usuarioLogueado = null;
let modeloNSFW = null;
let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

// --- 1. INICIALIZACIÓN ---
async function inicializar() {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        usuarioLogueado = session.user.user_metadata.username;
        const btnNav = document.getElementById('btn-login-nav') || document.getElementById('user-display');
        if(btnNav) btnNav.innerText = `@${usuarioLogueado}`;
    }
    try {
        if (typeof nsfwjs !== 'undefined') {
            modeloNSFW = await nsfwjs.load();
        }
    } catch (e) { console.error("IA Error:", e); }
    leerSecretos();
}
inicializar();

// --- 2. GESTIÓN DE CONTENIDO (FOTOS/VIDEOS) ---
function mostrarPreview(inputElement) {
    const file = inputElement.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.style.display = "block";
            const isVid = file.type.startsWith('video/');
            previewContainer.innerHTML = isVid 
                ? `<video src="${e.target.result}" id="temp-media" controls style="max-width:100%; border-radius:12px;"></video>` 
                : `<img src="${e.target.result}" id="temp-media" style="max-width:100%; border-radius:12px;">`;
            previewContainer.innerHTML += `<b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:black; color:white; padding:5px 10px; border-radius:50%;">✕</b>`;
        }
        reader.readAsDataURL(file);
    }
}

function cancelarPreview() { previewContainer.style.display = "none"; fotoInput.value = ""; }

function renderMedia(url, nsfw, id) {
    if(!url) return '';
    const blur = nsfw ? 'media-censurada' : '';
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i);
    let html = `<div style="position:relative; margin:10px 0;">`;
    if(nsfw) html += `<div class="nsfw-overlay" onclick="this.nextElementSibling.classList.remove('media-censurada'); this.remove()">NSFW - VER</div>`;
    
    if(isVid) {
        html += `<video src="${url}" controls class="card-img ${blur}"></video>`;
    } else {
        html += `<img src="${url}" class="card-img ${blur}" onclick="abrirCine('${url}')" style="cursor:zoom-in">`;
    }
    return html + `</div>`;
}

// --- 3. LÓGICA DE HILOS (RESPUESTAS INFINITAS) ---
async function leerSecretos(soloMios = false) {
    let q = _supabase.from('secretos').select('*');
    if (soloMios) q = q.eq('usuario_nombre', usuarioLogueado);
    else if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data } = await q;
    if (!data) return;

    // Filtramos los que son hilos principales (padre_id nulo)
    const principales = data.filter(s => !s.padre_id);
    
    container.innerHTML = principales.map(s => {
        // Buscamos todas las respuestas que pertenezcan a este hilo
        const susResp = data.filter(r => r.padre_id === s.id).sort((a,b) => a.id - b.id);
        const autor = s.usuario_nombre && s.usuario_nombre !== 'Anónimo' ? `@${s.usuario_nombre}` : `#${s.id}`;
        
        return `<div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">${autor} [+]</span>
                <p style="font-size:18px">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url, s.es_nsfw, s.id)}
                <div class="footer-card">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => {
                const autorR = r.usuario_nombre && r.usuario_nombre !== 'Anónimo' ? `@${r.usuario_nombre}` : `#${r.id}`;
                return `<div class="reply-card" style="margin-left:30px; border-left:2px solid #d32f2f; padding:10px 15px; background: #1a1a1a; margin-bottom:5px;">
                    <span class="reply-author" onclick="citarPost(${r.id})" style="cursor:pointer; color:red; font-size:11px;">${autorR} >> #${r.padre_id} [+]</span>
                    <p>${escaparHTML(r.contenido).replace(/>>(\d+)/g, '<b style="color:#d32f2f">>>$1</b>')}</p>
                    ${renderMedia(r.imagen_url, r.es_nsfw, r.id)}
                    <button class="like-btn" style="padding:2px 10px; font-size:12px;" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                    <button class="reply-btn" style="padding:2px 10px; font-size:12px;" onclick="prepararRespuesta(${s.id}, ${r.id})">💬</button>
                </div>`}).join('')}
        </div>`;
    }).join('');
}

// --- 4. INTERACCIONES ---
function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(respondiendoA || id, id); }

function prepararRespuesta(padreId, citandoId = null) { 
    respondiendoA = padreId; 
    const displayId = citandoId || padreId;
    replyIndicator.innerHTML = `[Respondiendo a #${displayId} ✖]`; 
    input.focus(); 
}

btnEnviar.onclick = async () => {
    if (!tokenCaptcha) return alert("Captcha, broski");
    const texto = input.value.trim();
    if(!texto && !fotoInput.files[0]) return;

    btnEnviar.disabled = true;
    btnEnviar.innerText = "Publicando...";
    
    try {
        let url = null;
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            const ext = f.name.split('.').pop();
            const n = `${Date.now()}.${ext}`;
            const { error: upError } = await _supabase.storage.from('imagenes').upload(n, f);
            if (upError) throw upError;
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        const { error: insError } = await _supabase.from('secretos').insert([{ 
            contenido: texto, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url,
            usuario_nombre: usuarioLogueado || 'Anónimo'
        }]);
        if (insError) throw insError;

        input.value = ""; cancelarPreview(); cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptcha = null;
        leerSecretos();
    } catch(e) { alert("Error: " + e.message); }
    finally { btnEnviar.innerText = "Publicar"; btnEnviar.disabled = false; }
};

// --- RESTO DE FUNCIONES (LIKE, AUTH, ETC) ---
async function reaccionar(id) {
    const yaLike = localStorage.getItem('v_'+id);
    const incremento = yaLike ? -1 : 1;
    const rpc = yaLike ? 'decrementar_reaccion' : 'incrementar_reaccion';
    
    // UI Optimista
    const btns = document.querySelectorAll(`button[onclick="reaccionar(${id})"]`);
    btns.forEach(b => {
        let n = parseInt(b.innerText.replace('🔥 ', '')) || 0;
        b.innerHTML = `🔥 ${Math.max(0, n + incremento)}`;
        b.style.color = yaLike ? "" : "#ff4500";
    });

    if(yaLike) localStorage.removeItem('v_'+id); else localStorage.setItem('v_'+id, '1');
    await _supabase.rpc(rpc, { row_id: id, columna_nombre: 'likes' });
}

function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; btnEnviar.disabled = false; }
function abrirCine(url) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-content').innerHTML = `<img src="${url}" style="max-width:100%">`;
    lb.style.display = 'flex';
}
