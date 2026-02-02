const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');

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

// --- LOGICA DE RESPUESTAS ---
function prepararRespuesta(id) {
    respondiendoA = id;
    replyIndicator.innerHTML = `<span class="cancelar-text" onclick="cancelarRespuesta()">[Responder a No.${id} ✖]</span>`;
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
    return isVideo ? 
        `<video src="${url}" controls playsinline class="card-img"></video>` : 
        `<img src="${url}" class="card-img" loading="lazy">`;
}

async function leerSecretos() {
    const { data, error } = await _supabase.from('secretos').select('*').eq('categoria', comunidadActual).order('created_at', { ascending: false });
    if (error || !data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);

    container.innerHTML = principal.map(s => {
        const susRespuestas = respuestas.filter(r => r.padre_id === s.id).reverse();
        return `
            <div class="post-group">
                <div class="card">
                    <div class="post-header"><span class="post-id" onclick="citarPost(${s.id})">No.${s.id} [+]</span></div>
                    <p>${s.contenido}</p>
                    ${renderMedia(s.imagen_url)}
                    <div class="footer-card">
                        <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 Responder</button>
                        <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                    </div>
                </div>
                ${susRespuestas.map(r => `
                    <div class="reply-card">
                        <div class="post-header"><span class="post-id" onclick="citarPost(${r.id})">No.${r.id} [+]</span></div>
                        <p>${r.contenido.replace(/>>(\d+)/g, '<span class="mention">>>$1</span>')}</p>
                        ${renderMedia(r.imagen_url)}
                        <div class="footer-card">
                            <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 Responder</button>
                        </div>
                    </div>
                `).join('')}
            </div>`;
    }).join('');
}

// --- CAPTCHA & ENVÍO ---
function captchaResuelto(token) { tokenCaptcha = token; btnEnviar.disabled = false; }
function captchaExpirado() { tokenCaptcha = null; btnEnviar.disabled = true; }

// Inicializar
leerSecretos();
