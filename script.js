const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let ultimaPublicacion = 0;
let respondiendoA = null; // ID del post que estamos comentando

// --- MODAL ---
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

// --- SISTEMA DE RESPUESTAS ---
function prepararRespuesta(id) {
    respondiendoA = id;
    input.placeholder = `Respondiendo al post #${id}...`;
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Crear botón para cancelar respuesta si no existe
    if(!document.getElementById('btn-cancelar-reply')) {
        const cancel = document.createElement('span');
        cancel.id = 'btn-cancelar-reply';
        cancel.innerHTML = " [✖ Cancelar respuesta]";
        cancel.style = "color:red; cursor:pointer; font-size:12px; font-weight:bold;";
        cancel.onclick = () => {
            respondiendoA = null;
            input.placeholder = "¿Qué está pasando?";
            cancel.remove();
        };
        input.parentNode.insertBefore(cancel, input);
    }
}

// --- COMUNIDADES ---
async function cambiarComunidad(cat) {
    comunidadActual = cat;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if(b.innerText.toLowerCase().includes(cat) || (cat === 'general' && b.innerText.includes('Inicio'))) {
            b.classList.add('active');
        }
    });
    input.placeholder = "¿Qué está pasando?";
    await leerSecretos();
}

// --- COMPRESIÓN DE IMAGEN ---
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

// --- ENVIAR ---
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
            padre_id: respondiendoA, // Guardamos la referencia al padre
            likes: 0, 
            dislikes: 0 
        }]);

        if (!error) {
            input.value = "";
            fotoInput.value = "";
            respondiendoA = null;
            if(document.getElementById('btn-cancelar-reply')) document.getElementById('btn-cancelar-reply').remove();
            document.getElementById('preview-container').style.display = 'none';
            ultimaPublicacion = ahora;
            turnstile.reset();
            await leerSecretos();
        }
    } catch (e) { console.error(e); turnstile.reset(); } 
    finally { btn.disabled = false; btn.innerText = "Publicar"; }
}

function cargarAds() {
    const ads = document.querySelectorAll('.ad-inline-active');
    ads.forEach(container => {
        if (container.getAttribute('data-loaded')) return;
        container.innerHTML = '<small style="color: #71767b; font-size: 10px;">PUBLICIDAD</small><div id="container-22e5c3e32301ad5e2fdcfd392d705a30"></div>';
        const script = document.createElement("script");
        script.src = "//pl16441576.highrevenuegate.com/22e5c3e32301ad5e2fdcfd392d705a30/invoke.js";
        script.async = true;
        container.appendChild(script);
        container.setAttribute('data-loaded', 'true');
    });
}

// --- LEER CON HILOS ---
async function leerSecretos() {
    const { data: todos } = await _supabase.from('secretos').select('*').order('created_at', { ascending: false });
    
    if (todos) {
        const principales = todos.filter(s => !s.padre_id);
        const respuestas = todos.filter(s => s.padre_id);
        let htmlFinal = "";

        principales.forEach((s, index) => {
            const yaVoto = localStorage.getItem(`voto_${s.id}`);
            const imgHtml = s.imagen_url ? `<img src="${s.imagen_url}" class="card-img" style="width:100%; border-radius:8px; margin:10px 0;">` : "";
            
            // Filtrar respuestas para este post
            const susRespuestas = respuestas.filter(r => r.padre_id === s.id);
            let respuestasHtml = "";
            susRespuestas.forEach(r => {
                respuestasHtml += `
                    <div class="reply-card" style="margin-left:25px; margin-top:5px; padding:10px; border-left:2px solid #333; background:#111; border-radius:0 8px 8px 0;">
                        <p style="font-size:0.9em; margin:0;">${escaparHTML(r.contenido)}</p>
                        <small style="color:#555; font-size:0.7em;">${new Date(r.created_at).toLocaleString()}</small>
                    </div>`;
            });

            htmlFinal += `
                <div class="post-group" style="margin-bottom:20px;">
                    <div class="card">
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
                    <div class="replies">${respuestasHtml}</div>
                </div>`;

            if ((index + 1) % 4 === 0) {
                htmlFinal += `<div class="ad-inline-active" style="padding: 15px; text-align: center;"></div>`;
            }
        });
        container.innerHTML = htmlFinal || '<p style="text-align:center;">No hay secretos...</p>';
        setTimeout(cargarAds, 600);
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
