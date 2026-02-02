const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let respondiendoA = null;
let tokenCaptcha = null; // Guardará la validación

// --- SEGURIDAD CAPTCHA ---
function captchaResuelto(token) { tokenCaptcha = token; btn.disabled = false; }
function captchaExpirado() { tokenCaptcha = null; btn.disabled = true; }

// --- FUNCIONALIDAD 4CHAN (CITAR) ---
function citarPost(id) {
    input.value += (input.value ? '\n' : '') + `>>${id} `;
    input.focus();
    if (!respondiendoA) prepararRespuesta(id);
}

// --- POLÍTICAS ---
const modal = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modal.style.display = 'none';
document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

function escaparHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- PREVIEW IMAGEN ---
function mostrarPreview(input) {
    const preview = document.getElementById('img-preview');
    const container = document.getElementById('preview-container');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; container.style.display = 'block'; }
        reader.readAsDataURL(input.files[0]);
    }
}
function cancelarFoto() { fotoInput.value = ""; document.getElementById('preview-container').style.display = 'none'; }

function cambiarComunidad(c) {
    comunidadActual = c;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event) event.target.classList.add('active');
    leerSecretos();
}

function prepararRespuesta(id, esComentario = false) {
    respondiendoA = id;
    input.placeholder = "Escribiendo respuesta...";
    input.focus();
    if(!document.getElementById('btn-cancelar')) {
        const c = document.createElement('span');
        c.id = 'btn-cancelar';
        c.innerHTML = " [✖ Cancelar]";
        c.className = "cancelar-text";
        c.onclick = () => { 
            respondiendoA = null; input.value = ""; 
            input.placeholder = "¿Qué está pasando?"; c.remove(); 
        };
        input.parentNode.insertBefore(c, input);
    }
}

async function reaccionar(id) {
    if (localStorage.getItem(`voto_${id}`)) return;
    const { error } = await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    if (!error) { localStorage.setItem(`voto_${id}`, 'true'); leerSecretos(); }
}

// --- RENDERIZADO TIPO 4CHAN ---
async function leerSecretos() {
    const { data } = await _supabase.from('secretos').select('*').eq('categoria', comunidadActual).order('created_at', { ascending: false });
    if (!data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);
    
    container.innerHTML = principal.map(s => {
        const susRespuestas = respuestas.filter(r => r.padre_id === s.id).reverse();
        const rHtml = susRespuestas.map(r => `
            <div class="reply-card ${r.contenido.includes('>>') ? 'nested-reply' : ''}">
                <div class="post-header">
                    <span class="post-author">Anónimo</span>
                    <span class="post-id" onclick="citarPost(${r.id})">No.${r.id} [+]</span>
                </div>
                <p>${escaparHTML(r.contenido).replace(/&gt;&gt;(\d+)/g, '<span class="mention">>>$1</span>')}</p>
                ${r.imagen_url ? `<img src="${r.imagen_url}" class="card-img-reply">` : ''}
                <button class="like-btn" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
            </div>
        `).join('');

        return `
            <div class="post-group">
                <div class="card">
                    <div class="post-header">
                        <span class="post-author">Anónimo</span>
                        <span class="post-id" onclick="citarPost(${s.id})">No.${s.id} [+]</span>
                    </div>
                    <p>${escaparHTML(s.contenido)}</p>
                    ${s.imagen_url ? `<img src="${s.imagen_url}" class="card-img">` : ''}
                    <div class="footer-card">
                        <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 Responder</button>
                        <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                    </div>
                </div>
                <div class="replies-container">${rHtml}</div>
            </div>`;
    }).join('');
}

// --- ENVÍO CON VALIDACIÓN ---
btn.onclick = async () => {
    if (!tokenCaptcha) { alert("Broski, resuelve el captcha primero."); return; }
    
    const texto = input.value.trim();
    const file = fotoInput.files[0];
    if(!texto && !file) return;
    
    btn.disabled = true;
    btn.innerText = "Publicando...";
    
    let urlFoto = null;
    try {
        if (file) {
            const fileName = `${Date.now()}_${file.name}`;
            const { error: upErr } = await _supabase.storage.from('imagenes').upload(fileName, file);
            if (upErr) throw upErr;
            urlFoto = _supabase.storage.from('imagenes').getPublicUrl(fileName).data.publicUrl;
        }

        await _supabase.from('secretos').insert([{
            contenido: texto, categoria: comunidadActual,
            padre_id: respondiendoA, imagen_url: urlFoto, likes: 0
        }]);

        input.value = "";
        cancelarFoto();
        respondiendoA = null;
        tokenCaptcha = null; // Reset captcha
        turnstile.reset(); // Reiniciar el widget de Cloudflare
        leerSecretos();
    } catch (e) {
        alert("Error de conexión.");
    } finally {
        btn.innerText = "Publicar";
        btn.disabled = true; // Se queda bloqueado hasta el siguiente captcha
    }
};

leerSecretos();
