const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;

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

document.addEventListener('DOMContentLoaded', inicializarTodo);

// --- RENDER DE MEDIOS ---
function renderMedia(url) {
    if (!url) return '';
    const esVideo = url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i);
    if (esVideo) {
        return `<video src="${url}" controls class="card-img"></video>`;
    }
    return `<img src="${url}" class="card-img" onclick="abrirCine('${url}')">`;
}

// --- PUBLICACIÓN ---
get('enviarBtn').onclick = async () => {
    if (!tokenCaptcha) return alert("Resuelve el captcha");
    const btn = get('enviarBtn');
    btn.disabled = true;
    btn.innerText = "...";

    try {
        let url = null;
        const file = get('fotoInput').files[0];
        if (file) {
            const n = `${Date.now()}.${file.name.split('.').pop()}`;
            await _supabase.storage.from('imagenes').upload(n, file);
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        await _supabase.from('secretos').insert([{ 
            contenido: get('secretoInput').value, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url 
        }]);

        get('secretoInput').value = ""; 
        get('fotoInput').value = "";
        cancelarPreview(); cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptcha = null;
        btn.disabled = true;
        leerSecretos();
    } catch(e) { alert("Error"); }
    finally { btn.innerText = "Publicar"; }
};

// --- CARGAR POSTS (CON TUS CLASES CSS) ---
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
        const yaLike = localStorage.getItem('v_' + s.id) ? 'like-active' : '';
        return `
        <div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p style="white-space: pre-wrap; font-size:18px;">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url)}
                <div class="footer-card" style="display:flex; gap:10px; margin-top:10px;">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button id="like-${s.id}" class="like-btn ${yaLike}" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => {
                const yaLikeR = localStorage.getItem('v_' + r.id) ? 'like-active' : '';
                return `
                <div class="card" style="margin-left:30px; border-left: 2px solid var(--accent-red); background: rgba(255,255,255,0.02); margin-bottom:10px;">
                    <p style="white-space: pre-wrap;">${escaparHTML(r.contenido)}</p>
                    ${renderMedia(r.imagen_url)}
                    <button id="like-${r.id}" class="like-btn ${yaLikeR}" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`}).join('')}
        </div>`;
    }).join('');
}

// --- LIKES SIN REFRESCAR ---
async function reaccionar(id) {
    const btn = document.getElementById(`like-${id}`);
    const ya = localStorage.getItem('v_' + id);
    
    // UI Feedback inmediato
    const count = parseInt(btn.innerText.replace('🔥 ', ''));
    if (ya) {
        btn.classList.remove('like-active');
        btn.innerText = `🔥 ${count - 1}`;
        localStorage.removeItem('v_' + id);
        await _supabase.rpc('decrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    } else {
        btn.classList.add('like-active');
        btn.innerText = `🔥 ${count + 1}`;
        localStorage.setItem('v_' + id, '1');
        await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    }
}

// --- RESTO DE FUNCIONES ---
window.verInicio = () => { filtroTop = false; comunidadActual = 'general'; actualizarTabs('inicio'); leerSecretos(); };
window.verTop = () => { filtroTop = true; actualizarTabs('top'); leerSecretos(); };
function actualizarTabs(t) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(t))); }
function mostrarPreview(el) {
    const f = el.files[0];
    if (f) {
        const r = new FileReader();
        r.onload = (e) => {
            get('preview-container').style.display = "block";
            get('preview-container').innerHTML = f.type.startsWith('video/') 
                ? `<video src="${e.target.result}" style="max-width:100%; border-radius:12px;"></video>`
                : `<img src="${e.target.result}" style="max-width:100%; border-radius:12px;">`;
            get('preview-container').innerHTML += `<b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:black; color:white; padding:5px; border-radius:50%;">✕</b>`;
        };
        r.readAsDataURL(f);
    }
}
function citarPost(id) { get('secretoInput').value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; get('reply-indicator').innerHTML = `<span style="color:var(--accent-red); cursor:pointer" onclick="cancelarRespuesta()">[Resp #${id} ✖]</span>`; get('secretoInput').focus(); }
function cancelarRespuesta() { respondiendoA = null; get('reply-indicator').innerHTML = ""; }
function cancelarPreview() { get('preview-container').style.display = "none"; get('fotoInput').value = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; get('enviarBtn').disabled = false; }
function abrirCine(url) { get('lightbox-content').innerHTML = `<img src="${url}">`; get('lightbox').style.display = 'flex'; }
