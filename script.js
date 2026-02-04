const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;

// Referencias seguras
const get = (id) => document.getElementById(id);

// --- MODAL Y ARRANQUE ---
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTodo);
} else {
    inicializarTodo();
}

// --- RENDER DE MEDIOS (VÍDEOS Y FOTOS) ---
function renderMedia(url) {
    if (!url) return '';
    // Detectar si es video por extensión
    const esVideo = url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i);
    
    if (esVideo) {
        return `<video src="${url}" controls class="card-img" style="max-height:400px; width:100%; border-radius:12px; margin-top:10px;"></video>`;
    }
    return `<img src="${url}" class="card-img" onclick="abrirCine('${url}')" style="cursor:zoom-in; border-radius:12px; margin-top:10px;">`;
}

// --- PUBLICACIÓN ---
get('enviarBtn').onclick = async () => {
    if (!tokenCaptcha) return alert("Resuelve el captcha");
    const btn = get('enviarBtn');
    btn.disabled = true;
    btn.innerText = "Subiendo...";

    try {
        let url = null;
        const file = get('fotoInput').files[0];

        if (file) {
            const n = `${Date.now()}.${file.name.split('.').pop()}`;
            const { error: upErr } = await _supabase.storage.from('imagenes').upload(n, file);
            if (upErr) throw upErr;
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        const { error: insErr } = await _supabase.from('secretos').insert([{ 
            contenido: get('secretoInput').value, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url 
        }]);

        if (insErr) throw insErr;

        get('secretoInput').value = ""; 
        get('fotoInput').value = "";
        cancelarPreview(); cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptcha = null;
        leerSecretos();

    } catch(e) { 
        alert("Error al publicar"); 
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

    const { data } = await q;
    if (!data) return;

    const hilos = data.filter(s => !s.padre_id);
    container.innerHTML = hilos.map(s => {
        const susResp = data.filter(r => r.padre_id === s.id).sort((a,b) => a.id - b.id);
        const yaLike = localStorage.getItem('v_' + s.id) ? 'style="color:#ff4500"' : '';
        return `
        <div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p style="white-space: pre-wrap;">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url)}
                <div class="footer-card">
                    <button onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" ${yaLike} onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => `
                <div class="reply-card" style="margin-left:20px; border-left: 2px solid #ff0000; padding:10px; background:#111;">
                    <p style="white-space: pre-wrap;">${escaparHTML(r.contenido)}</p>
                    ${renderMedia(r.imagen_url)}
                    <button onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`).join('')}
        </div>`;
    }).join('');
}

// --- UTILIDADES RESTANTES ---
window.verInicio = () => { filtroTop = false; comunidadActual = 'general'; actualizarTabs('inicio'); leerSecretos(); };
window.verTop = () => { filtroTop = true; actualizarTabs('top'); leerSecretos(); };
function actualizarTabs(t) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(t))); }
function mostrarPreview(el) {
    const f = el.files[0];
    if (f) {
        const r = new FileReader();
        r.onload = (e) => {
            get('preview-container').style.display = "block";
            const isV = f.type.startsWith('video/');
            get('preview-container').innerHTML = isV 
                ? `<video src="${e.target.result}" style="max-width:100%; border-radius:12px;"></video>`
                : `<img src="${e.target.result}" style="max-width:100%; border-radius:12px;">`;
            get('preview-container').innerHTML += `<b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:black; color:white; padding:5px; border-radius:50%;">✕</b>`;
        };
        r.readAsDataURL(f);
    }
}
async function reaccionar(id) {
    const ya = localStorage.getItem('v_' + id);
    await _supabase.rpc(ya ? 'decrementar_reaccion' : 'incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    ya ? localStorage.removeItem('v_'+id) : localStorage.setItem('v_'+id, '1');
    leerSecretos();
}
function citarPost(id) { get('secretoInput').value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; get('reply-indicator').innerHTML = `[Resp #${id} ✖]`; get('secretoInput').focus(); }
function cancelarRespuesta() { respondiendoA = null; get('reply-indicator').innerHTML = ""; }
function cancelarPreview() { get('preview-container').style.display = "none"; get('fotoInput').value = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; get('enviarBtn').disabled = false; }
function abrirCine(url) { get('lightbox-content').innerHTML = `<img src="${url}" style="max-width:100%">`; get('lightbox').style.display = 'flex'; }
