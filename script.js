const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let ultimaPublicacion = 0;
let respondiendoA = null;

// --- MODAL DE POLÍTICAS ---
const modal = document.getElementById('modal-politicas');
const btnAceptar = document.getElementById('btn-aceptar');
const btnRechazar = document.getElementById('btn-rechazar');

if (localStorage.getItem('politicasAceptadas') === 'true') {
    modal.style.display = 'none';
}
btnAceptar.onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};
btnRechazar.onclick = () => window.location.href = "https://google.com";

// --- SEGURIDAD: ANTI-XSS ---
function escaparHTML(str) {
    if (!str) return "";
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- TOGGLE DE RESPUESTAS ---
function toggleRespuestas(id) {
    const div = document.getElementById(`respuestas-${id}`);
    const btnToggle = document.getElementById(`btn-toggle-${id}`);
    if (div.style.display === "none") {
        div.style.display = "block";
        btnToggle.innerText = "Ocultar respuestas";
    } else {
        div.style.display = "none";
        btnToggle.innerText = `Ver respuestas`;
    }
}

// --- SISTEMA DE RESPUESTAS (HILOS ANIDADOS) ---
function prepararRespuesta(id, mencionId = null) {
    respondiendoA = id;
    if (mencionId) {
        input.value = `>>${mencionId} `; 
        input.placeholder = `Respondiendo al comentario #${mencionId}...`;
    } else {
        input.placeholder = `Respondiendo al post #${id}...`;
    }
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if(!document.getElementById('btn-cancelar-reply')) {
        const cancel = document.createElement('span');
        cancel.id = 'btn-cancelar-reply';
        cancel.innerHTML = " [✖ Cancelar]";
        cancel.className = "cancelar-text";
        cancel.onclick = () => {
            respondiendoA = null;
            input.value = "";
            input.placeholder = "¿Qué está pasando?";
            cancel.remove();
        };
        input.parentNode.insertBefore(cancel, input);
    }
}

// --- COMPRESIÓN Y LIMPIEZA DE IMAGEN (BORRA GPS) ---
async function comprimirImagen(archivo) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.7);
            };
        };
    });
}

// --- REACCIONES ---
async function reaccionar(id, columna) {
    if (localStorage.getItem(`voto_${id}`)) return alert("Ya reaccionaste, broski.");
    const { error } = await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: columna });
    if (!error) {
        localStorage.setItem(`voto_${id}`, 'true');
        await leerSecretos();
    }
}

// --- ENVIAR SECRETO O RESPUESTA ---
async function enviarSecreto() {
    const ahora = Date.now();
    const texto = input.value.trim();
    const captchaRes = turnstile.getResponse();
    const file = fotoInput.files[0];

    if (ahora - ultimaPublicacion < 10000) return alert("Espera 10 segundos.");
    if (texto.length > 1000) return alert("Muy largo.");
    if (!captchaRes || captchaRes.length < 20) return alert("Haz el captcha.");
    if (!texto && !file) return alert("Escribe algo...");

    btn.disabled = true;
    btn.innerText = "Publicando...";
    let urlFoto = null;

    try {
        if (file) {
            const { data: uploadData, error: uploadError } = await _supabase.storage
                .from('imagenes').upload(`${Date.now()}.webp`, await comprimirImagen(file));
            if (!uploadError) {
                const { data: urlData } = _supabase.storage.from('imagenes').getPublicUrl(uploadData.path);
                urlFoto = urlData.publicUrl;
            }
        }

        const { error } = await _supabase.from('secretos').insert([{ 
            contenido: texto, 
            imagen_url: urlFoto, 
            categoria: comunidadActual,
            padre_id: respondiendoA,
            likes: 0, 
            dislikes: 0 
        }]);

        if (!error) {
            input.value = "";
            fotoInput.value = "";
            respondiendoA = null;
            if(document.getElementById('btn-cancelar-reply')) document.getElementById('btn-cancelar-reply').remove();
            ultimaPublicacion = ahora;
            turnstile.reset();
            await leerSecretos();
        }
    } catch (e) { console.error(e); turnstile.reset(); } 
    finally { btn.disabled = false; btn.innerText = "Publicar"; }
}

// --- RENDERIZADO DEL FEED ---
async function leerSecretos() {
    const { data: todos } = await _supabase.from('secretos').select('*').order('created_at', { ascending: false });
    
    if (todos) {
        const principales = todos.filter(s => !s.padre_id);
        const respuestas = todos.filter(s => s.padre_id);
        let htmlFinal = "";

        principales.forEach((s, index) => {
            const yaVoto = localStorage.getItem(`voto_${s.id}`);
            const imgHtml = s.imagen_url ? `<img src="${s.imagen_url}" class="card-img">` : "";
            const susRespuestas = respuestas.filter(r => r.padre_id === s.id);
            let respuestasHtml = "";
            
            susRespuestas.forEach(r => {
                const rImg = r.imagen_url ? `<img src="${r.imagen_url}" class="card-img-reply">` : "";
                const rVoto = localStorage.getItem(`voto_${r.id}`);
                respuestasHtml += `
                    <div class="reply-card">
                        <small class="post-id">ID: #${r.id}</small>
                        <p>${escaparHTML(r.contenido)}</p>
                        ${rImg}
                        <div class="footer-card">
                            <small>${new Date(r.created_at).toLocaleString()}</small>
                            <div class="actions">
                                <button class="reply-btn-inner" onclick="prepararRespuesta(${s.id}, ${r.id})">↩ Responder</button>
                                <button class="like-btn" ${rVoto ? 'disabled' : ''} onclick="reaccionar(${r.id}, 'likes')">🔥 ${r.likes || 0}</button>
                            </div>
                        </div>
                    </div>`;
            });

            const btnToggle = susRespuestas.length > 0 
                ? `<button id="btn-toggle-${s.id}" class="toggle-btn" onclick="toggleRespuestas(${s.id})">Ver ${susRespuestas.length} respuestas</button>` 
                : "";

            htmlFinal += `
                <div class="post-group">
                    <div class="card">
                        <small class="post-id">ID: #${s.id}</small>
                        <p>${escaparHTML(s.contenido)}</p>
                        ${imgHtml}
                        <div class="footer-card">
                            <small>${new Date(s.created_at).toLocaleString()}</small>
                            <div class="actions">
                                <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                                <button class="like-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, 'likes')">🔥 ${s.likes || 0}</button>
                            </div>
                        </div>
                    </div>
                    ${btnToggle}
                    <div id="respuestas-${s.id}" class="replies-container" style="display:none;">
                        ${respuestasHtml}
                    </div>
                </div>`;
            
            if ((index + 1) % 4 === 0) {
                htmlFinal += `<div class="ad-inline-active"></div>`;
            }
        });
        container.innerHTML = htmlFinal || '<p style="text-align:center;">No hay secretos...</p>';
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
