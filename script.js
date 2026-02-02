const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let respondiendoA = null;
let tokenCaptcha = null;

// --- CONTROL DE ACCESO ---
const modal = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modal.style.display = 'none';
document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

// --- LÓGICA DE RESPUESTAS ---
function prepararRespuesta(id) {
    respondiendoA = id;
    replyIndicator.innerHTML = `<span class="cancelar-text" onclick="cancelarRespuesta()" style="color: #8b0000; cursor:pointer; font-weight:bold;">[Respondiendo a No.${id} ✖]</span>`;
    input.placeholder = "Escribe tu respuesta...";
    input.focus();
    window.scrollTo({ top: document.getElementById('form-area').offsetTop - 100, behavior: 'smooth' });
}

function cancelarRespuesta() {
    respondiendoA = null;
    replyIndicator.innerHTML = "";
    input.placeholder = "¿Qué está pasando?";
}

function citarPost(id) {
    input.value += `>>${id} `;
    prepararRespuesta(id);
}

// --- RENDERIZADO ---
function renderMedia(url) {
    if(!url) return '';
    const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg|mov)/i);
    // Añadimos preload="metadata" para carga más rápida
    return isVideo ? 
        `<video src="${url}" controls preload="metadata" playsinline class="card-img"></video>` : 
        `<img src="${url}" class="card-img" loading="lazy">`;
}

function escaparHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function leerSecretos() {
    const { data, error } = await _supabase.from('secretos')
        .select('*')
        .eq('categoria', comunidadActual)
        .order('created_at', { ascending: false });

    if (error || !data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);

    container.innerHTML = principal.map(s => {
        const susRespuestas = respuestas.filter(r => r.padre_id === s.id).reverse();
        return `
            <div class="post-group">
                <div class="card">
                    <div class="post-header" style="margin-bottom:10px;">
                        <span class="post-id" style="color:var(--text-dim); font-size:12px; cursor:pointer;" onclick="citarPost(${s.id})">
                            ID #${s.id} <b style="color:var(--accent-red)">[+]</b>
                        </span>
                    </div>
                    <p style="line-height:1.5; font-size:17px;">${escaparHTML(s.contenido)}</p>
                    ${renderMedia(s.imagen_url)}
                    <div class="footer-card">
                        <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 RESPONDER</button>
                        <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                    </div>
                </div>
                ${susRespuestas.map(r => `
                    <div class="reply-card">
                        <div class="card" style="padding:15px 20px;">
                            <span class="post-id" style="color:var(--text-dim); font-size:11px;" onclick="citarPost(${r.id})">#${r.id}</span>
                            <p style="font-size:15px;">${escaparHTML(r.contenido).replace(/>>(\d+)/g, '<span style="color:var(--accent-red); font-weight:bold;">>>$1</span>')}</p>
                            ${renderMedia(r.imagen_url)}
                            <div class="footer-card" style="border:none; padding:0; margin-top:10px;">
                                <button class="reply-btn" style="padding:5px 12px; font-size:11px;" onclick="prepararRespuesta(${s.id})">💬</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }).join('');
}

// --- ACCIONES (LIKE Y ENVÍO) ---
async function reaccionar(id) {
    if (localStorage.getItem(`voto_${id}`)) return;
    const { error } = await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    if (!error) { 
        localStorage.setItem(`voto_${id}`, 'true'); 
        leerSecretos(); 
    }
}

btnEnviar.onclick = async () => {
    if (!tokenCaptcha) { alert("Broski, falta el captcha."); return; }
    const texto = input.value.trim();
    const file = fotoInput.files[0];
    if (!texto && !file) return;

    btnEnviar.disabled = true;
    btnEnviar.innerText = "Subiendo...";
    let urlFoto = null;

    try {
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await _supabase.storage.from('imagenes').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data } = _supabase.storage.from('imagenes').getPublicUrl(fileName);
            urlFoto = data.publicUrl;
        }

        const { error: insertError } = await _supabase.from('secretos').insert([{
            contenido: texto,
            categoria: comunidadActual,
            padre_id: respondiendoA,
            imagen_url: urlFoto,
            likes: 0
        }]);

        if (insertError) throw insertError;

        // Limpiar
        input.value = "";
        fotoInput.value = "";
        if (window.turnstile) turnstile.reset();
        cancelarRespuesta();
        leerSecretos();
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btnEnviar.innerText = "Publicar";
        btnEnviar.disabled = false;
    }
};

function cambiarComunidad(c) {
    comunidadActual = c;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(c)));
    leerSecretos();
}

function captchaResuelto(token) { tokenCaptcha = token; btnEnviar.disabled = false; }
function captchaExpirado() { tokenCaptcha = null; btnEnviar.disabled = true; }

leerSecretos();
