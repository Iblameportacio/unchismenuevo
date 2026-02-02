const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let respondiendoA = null;
let tokenCaptcha = null;

// --- SEGURIDAD CAPTCHA ---
function captchaResuelto(token) { tokenCaptcha = token; btn.disabled = false; }
function captchaExpirado() { tokenCaptcha = null; btn.disabled = true; }

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

// --- PREVIEW MEJORADO (FOTOS Y VIDEOS) ---
function mostrarPreview(input) {
    const containerPreview = document.getElementById('preview-container');
    const file = input.files[0];
    
    if (file) {
        // VALIDACIÓN DE PESO: 15MB
        const limiteMB = 15 * 1024 * 1024;
        if (file.size > limiteMB) {
            alert("Broski, ese archivo pesa demasiado. El límite son 15MB.");
            cancelarFoto();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => { 
            // Limpiamos y detectamos tipo
            containerPreview.innerHTML = '<span onclick="cancelarFoto()" class="cancelar-preview">✕</span>';
            
            if (file.type.startsWith('video/')) {
                containerPreview.innerHTML += `<video src="${e.target.result}" id="img-preview" autoplay muted loop style="width:100%; border-radius:12px;"></video>`;
            } else {
                containerPreview.innerHTML += `<img src="${e.target.result}" id="img-preview" style="width:100%; border-radius:12px;">`;
            }
            containerPreview.style.display = 'block'; 
        }
        reader.readAsDataURL(file);
    }
}

function cancelarFoto() { 
    fotoInput.value = ""; 
    document.getElementById('preview-container').style.display = 'none'; 
    document.getElementById('preview-container').innerHTML = '';
}

function cambiarComunidad(c) {
    comunidadActual = c;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event) event.target.classList.add('active');
    leerSecretos();
}

function prepararRespuesta(id) {
    respondiendoA = id;
    input.placeholder = `Respondiendo al No.${id}...`;
    input.focus();
    if(!document.getElementById('btn-cancelar')) {
        const c = document.createElement('span');
        c.id = 'btn-cancelar';
        c.innerHTML = " [✖ Cancelar]";
        c.className = "cancelar-text";
        c.onclick = () => { 
            respondiendoA = null; 
            input.value = ""; 
            input.placeholder = "¿Qué está pasando?"; 
            c.remove(); 
        };
        input.parentNode.insertBefore(c, input);
    }
}

async function reaccionar(id) {
    if (localStorage.getItem(`voto_${id}`)) return;
    const { error } = await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    if (!error) { 
        localStorage.setItem(`voto_${id}`, 'true'); 
        leerSecretos(); 
    }
}

// --- RENDERIZADO CON SOPORTE VIDEO ---
async function leerSecretos() {
    const { data, error } = await _supabase
        .from('secretos')
        .select('*')
        .eq('categoria', comunidadActual)
        .order('created_at', { ascending: false });

    if (error || !data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);
    
    container.innerHTML = principal.map(s => {
        const susRespuestas = respuestas.filter(r => r.padre_id === s.id).reverse();
        
        const renderMedia = (url, isReply) => {
            if(!url) return '';
            const isVideo = url.match(/\.(mp4|webm|ogg)/i);
            const clase = isReply ? 'card-img-reply' : 'card-img';
            return isVideo ? `<video src="${url}" controls class="${clase}"></video>` : `<img src="${url}" class="${clase}">`;
        };

        const rHtml = susRespuestas.map(r => `
            <div class="reply-card">
                <div class="post-header">
                    <span class="post-author">Anónimo</span>
                    <span class="post-id" onclick="citarPost(${r.id})">No.${r.id} [+]</span>
                </div>
                <p>${escaparHTML(r.contenido).replace(/&gt;&gt;(\d+)/g, '<span class="mention">>>$1</span>')}</p>
                ${renderMedia(r.imagen_url, true)}
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
                    <p>${escaparHTML(s.contenido).replace(/&gt;&gt;(\d+)/g, '<span class="mention">>>$1</span>')}</p>
                    ${renderMedia(s.imagen_url, false)}
                    <div class="footer-card">
                        <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 Responder</button>
                        <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                    </div>
                </div>
                <div class="replies-container">${rHtml}</div>
            </div>`;
    }).join('');
}

// --- ENVÍO CON SOPORTE MULTIMEDIA ---
btn.onclick = async () => {
    if (!tokenCaptcha) { alert("Resuelve el captcha primero."); return; }
    const texto = input.value.trim();
    const file = fotoInput.files[0];
    if(!texto && !file) return;
    
    btn.disabled = true;
    btn.innerText = "Subiendo...";
    let urlFoto = null;

    try {
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;

            const { error: uploadError } = await _supabase.storage
                .from('imagenes')
                .upload(fileName, file);

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

        input.value = "";
        cancelarFoto();
        respondiendoA = null;
        tokenCaptcha = null;
        if(window.turnstile) turnstile.reset();
        if(document.getElementById('btn-cancelar')) document.getElementById('btn-cancelar').remove();
        input.placeholder = "¿Qué está pasando?";
        leerSecretos();

    } catch (err) {
        console.error("Error:", err);
        alert("Fallo al publicar: " + err.message);
    } finally {
        btn.innerText = "Publicar";
        btn.disabled = false;
    }
};

leerSecretos();
