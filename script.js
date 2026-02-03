const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;
let tokenCaptcha = null;
let modeloNSFW = null;

// --- CARGAR IA MODERADORA ---
nsfwjs.load().then(m => { 
    modeloNSFW = m; 
    console.log("IA Lista para patrullar, broski");
});

// --- CONTROL DE ACCESO ---
const modal = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modal.style.display = 'none';
document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

// --- PREVIEW Y ANALISIS ---
function mostrarPreview(inputElement) {
    previewContainer.innerHTML = "";
    const file = inputElement.files[0];
    if (file) {
        if (file.size > 15 * 1024 * 1024) { alert("¡15MB máximo!"); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.style.display = "block";
            const isVid = file.type.startsWith('video/');
            previewContainer.innerHTML = isVid 
                ? `<video src="${e.target.result}" id="temp-media" controls style="max-width:100%; border-radius:12px;"></video>` 
                : `<img src="${e.target.result}" id="temp-media" style="max-width:100%; border-radius:12px;">`;
            previewContainer.innerHTML += `<b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:rgba(0,0,0,0.8); color:white; padding:5px 10px; border-radius:50%;">✕</b>`;
        }
        reader.readAsDataURL(file);
    }
}
function cancelarPreview() { previewContainer.style.display = "none"; fotoInput.value = ""; }

// --- IA: DETECTAR XXX ---
async function esContenidoXXX() {
    const media = document.getElementById('temp-media');
    if (!modeloNSFW || !media || media.tagName === 'VIDEO') return false; 
    const predicciones = await modeloNSFW.classify(media);
    return predicciones.some(p => (p.className === 'Porn' || p.className === 'Hentai') && p.probability > 0.6);
}

// --- NAVEGACIÓN ---
function cambiarComunidad(c) {
    comunidadActual = c; filtroTop = false;
    actualizarTabs(c); leerSecretos();
}
function verTop() {
    filtroTop = true; actualizarTabs('top'); leerSecretos();
}
function actualizarTabs(id) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(id)));
}

// --- RENDERIZADO CON FILTRO ---
async function leerSecretos() {
    let q = _supabase.from('secretos').select('*');
    if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data, error } = await q;
    if (error) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);

    container.innerHTML = principal.map(s => {
        const susResp = respuestas.filter(r => r.padre_id === s.id).reverse();
        return `<div class="post-group">
            <div class="card">
                <span class="post-id" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p>${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url, s.es_nsfw, s.id)}
                <div class="footer-card">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 RESPONDER</button>
                    <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => `<div class="reply-card"><div class="card">
                <span class="post-id">#${r.id} >> #${r.padre_id}</span>
                <p>${escaparHTML(r.contenido).replace(/>>(\d+)/g, '<span style="color:var(--accent-red)">>>$1</span>')}</p>
                ${renderMedia(r.imagen_url, r.es_nsfw, r.id)}
                <div class="footer-card"><button class="like-btn" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button></div>
            </div></div>`).join('')}
        </div>`;
    }).join('');
}

function renderMedia(url, nsfw, id) {
    if(!url) return '';
    const blur = nsfw ? 'media-censurada' : '';
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov)/i);
    let html = `<div class="media-wrapper" style="position:relative; margin:10px 0;">`;
    if(nsfw) html += `<div class="nsfw-overlay" onclick="this.nextElementSibling.classList.toggle('media-revelada'); this.remove()">CONTENIDO NSFW - VER</div>`;
    html += isVid ? `<video src="${url}" controls class="card-img ${blur}"></video>` : `<img src="${url}" class="card-img ${blur}" loading="lazy">`;
    if(!nsfw) html += `<button class="report-btn" onclick="reportar(${id})">⚠️ Reportar XXX</button>`;
    return html + `</div>`;
}

// --- ACCIONES ---
btnEnviar.onclick = async () => {
    if (!tokenCaptcha) { alert("Resuelve el captcha, broski"); return; }
    const texto = input.value.trim();
    if (!texto && !fotoInput.files[0]) return;

    btnEnviar.disabled = true;
    btnEnviar.innerText = "Analizando...";
    
    let esNSFW = await esContenidoXXX();
    let cat = comunidadActual;
    ['#tech','#musica','#paranormal','#xxx'].forEach(t => { if(texto.toLowerCase().includes(t)) cat = t.replace('#',''); });
    if(texto.toLowerCase().includes('#xxx')) esNSFW = true;

    try {
        let url = null;
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            const n = `${Date.now()}.${f.name.split('.').pop()}`;
            await _supabase.storage.from('imagenes').upload(n, f);
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }
        await _supabase.from('secretos').insert([{ 
            contenido: texto, categoria: cat, padre_id: respondiendoA, imagen_url: url, es_nsfw: esNSFW 
        }]);
        input.value = ""; cancelarPreview(); cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        leerSecretos();
    } catch(e) { alert("Error"); }
    finally { btnEnviar.innerText = "Publicar"; btnEnviar.disabled = false; }
};

async function reportar(id) {
    if(localStorage.getItem('rep_'+id)) return;
    const { error } = await _supabase.rpc('reportar_post', { row_id: id });
    if(!error) { localStorage.setItem('rep_'+id, '1'); alert("Reportado"); leerSecretos(); }
}

async function reaccionar(id) {
    if(localStorage.getItem('v_'+id)) return;
    await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    localStorage.setItem('v_'+id, '1'); leerSecretos();
}

// --- AUXILIARES ---
function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Respondiendo a #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; btnEnviar.disabled = false; }
function captchaExpirado() { tokenCaptcha = null; btnEnviar.disabled = true; }

leerSecretos();
