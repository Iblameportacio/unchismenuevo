const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;

const get = (id) => document.getElementById(id);

// --- ARRANQUE SEGURO ---
const inicializarTodo = () => {
    const modal = get('modal-politicas');
    const btnAceptar = get('btn-aceptar');
    if (localStorage.getItem('politicasAceptadas')) {
        if (modal) modal.style.display = 'none';
    }
    if (btnAceptar) {
        btnAceptar.onclick = () => {
            localStorage.setItem('politicasAceptadas', 'true');
            if (modal) modal.style.display = 'none';
        };
    }
    leerSecretos();
};

document.addEventListener('DOMContentLoaded', inicializarTodo);

// --- RENDER DE MEDIOS (VÍDEOS SIN LAG) ---
function renderMedia(url) {
    if (!url) return '';
    const esVideo = url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i);
    if (esVideo) {
        return `<video src="${url}" controls playsinline muted class="card-img" style="display:block; width:100%; background:#000;"></video>`;
    }
    return `<img src="${url}" class="card-img" onclick="abrirCine('${url}')" loading="lazy" style="cursor:zoom-in;">`;
}

// --- PUBLICACIÓN (CON BLOQUEO DE DUPLICADOS) ---
get('enviarBtn').onclick = async () => {
    const btn = get('enviarBtn');
    if (!tokenCaptcha || btn.disabled) return;
    
    const txt = get('secretoInput').value.trim();
    if(!txt && !get('fotoInput').files[0]) return;

    btn.disabled = true;
    btn.innerText = "⏳";

    try {
        let url = null;
        const file = get('fotoInput').files[0];
        if (file) {
            const ext = file.name.split('.').pop();
            const n = `${Date.now()}.${ext}`;
            const { data, error: upErr } = await _supabase.storage.from('imagenes').upload(n, file);
            if (upErr) throw upErr;
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        const { error: insErr } = await _supabase.from('secretos').insert([{ 
            contenido: txt, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url 
        }]);
        
        if (insErr) throw insErr;

        // Limpieza exitosa
        get('secretoInput').value = ""; 
        get('fotoInput').value = "";
        cancelarPreview(); 
        cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptcha = null;
        
        // Recarga suave
        await leerSecretos();
    } catch(e) { 
        console.error("Error en post:", e);
        alert("Fallo al subir. Revisa tu conexión."); 
    } finally { 
        btn.disabled = false;
        btn.innerText = "Publicar"; 
    }
};

// --- CARGAR POSTS ---
async function leerSecretos() {
    const container = get('secretos-container');
    if (!container) return;

    let q = _supabase.from('secretos').select('*');
    if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data, error } = await q;
    if (error || !data) return;

    const hilos = data.filter(s => !s.padre_id);
    container.innerHTML = hilos.map(s => {
        const susResp = data.filter(r => r.padre_id === s.id).sort((a,b) => a.id - b.id);
        const yaLike = localStorage.getItem('v_' + s.id) ? 'like-active' : '';
        return `
        <div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p style="white-space: pre-wrap; font-size:18px; margin: 12px 0;">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url)}
                <div class="footer-card" style="display:flex; gap:10px; margin-top:10px;">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button id="like-${s.id}" class="like-btn ${yaLike}" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => {
                const yaLikeR = localStorage.getItem('v_' + r.id) ? 'like-active' : '';
                return `
                <div class="card" style="margin-left:35px; border-left: 2px solid var(--accent-red); background: rgba(22, 27, 34, 0.4); margin-bottom:8px; padding: 15px;">
                    <span class="post-author" style="font-size:12px; opacity:0.7;">#${r.id}</span>
                    <p style="white-space: pre-wrap; margin: 8px 0;">${escaparHTML(r.contenido)}</p>
                    ${renderMedia(r.imagen_url)}
                    <button id="like-${r.id}" class="like-btn ${yaLikeR}" onclick="reaccionar(${r.id})" style="margin-top:10px;">🔥 ${r.likes || 0}</button>
                </div>`}).join('')}
        </div>`;
    }).join('');
}

// --- LIKES (REDUCCIÓN DE LATENCIA) ---
async function reaccionar(id) {
    const btn = document.getElementById(`like-${id}`);
    if (!btn) return;
    
    const ya = localStorage.getItem('v_' + id);
    let count = parseInt(btn.innerText.replace('🔥 ', '')) || 0;

    // Efecto visual inmediato (Optimista)
    if (ya) {
        btn.classList.remove('like-active');
        btn.innerText = `🔥 ${Math.max(0, count - 1)}`;
        localStorage.removeItem('v_' + id);
        _supabase.rpc('decrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    } else {
        btn.classList.add('like-active');
        btn.innerText = `🔥 ${count + 1}`;
        localStorage.setItem('v_' + id, '1');
        _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    }
}

// --- UTILIDADES ---
window.verInicio = () => { filtroTop = false; comunidadActual = 'general'; actualizarTabs('inicio'); leerSecretos(); };
window.verTop = () => { filtroTop = true; actualizarTabs('top'); leerSecretos(); };
function actualizarTabs(t) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(t))); }

function mostrarPreview(el) {
    const f = el.files[0];
    const prev = get('preview-container');
    if (f && prev) {
        const r = new FileReader();
        r.onload = (e) => {
            prev.style.display = "block";
            prev.innerHTML = f.type.startsWith('video/') 
                ? `<video src="${e.target.result}" style="max-width:100%; border-radius:12px;" muted autoplay loop></video>`
                : `<img src="${e.target.result}" style="max-width:100%; border-radius:12px;">`;
            prev.innerHTML += `<b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:rgba(0,0,0,0.8); color:white; width:25px; height:25px; display:flex; align-items:center; justify-content:center; border-radius:50%;">✕</b>`;
        };
        r.readAsDataURL(f);
    }
}

function citarPost(id) { get('secretoInput').value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { 
    respondiendoA = id; 
    get('reply-indicator').innerHTML = `<div style="color:var(--accent-red); margin-bottom:10px; font-size:14px;">Respondida a #${id} <span onclick="cancelarRespuesta()" style="cursor:pointer; margin-left:5px;">[X]</span></div>`; 
    get('secretoInput').focus(); 
}
function cancelarRespuesta() { respondiendoA = null; get('reply-indicator').innerHTML = ""; }
function cancelarPreview() { get('preview-container').style.display = "none"; get('fotoInput').value = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; get('enviarBtn').disabled = false; }
function abrirCine(url) { 
    const lb = get('lightbox');
    get('lightbox-content').innerHTML = url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i)
        ? `<video src="${url}" controls autoplay style="max-width:95vw; max-height:95vh;"></video>`
        : `<img src="${url}" style="max-width:95vw; max-height:95vh;">`;
    lb.style.display = 'flex'; 
}
