const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIABLES GLOBALES
let usuarioLogueado = null;
let modeloNSFW = null;
let tokenCaptchaPost = null;
let tokenCaptchaReg = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

// 1. INICIALIZACIÓN (FIX IA Y SESIÓN)
async function inicializar() {
    // Cargar sesión
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        usuarioLogueado = session.user.user_metadata.username;
        const btnNav = document.getElementById('btn-login-nav') || document.getElementById('user-display');
        if(btnNav) btnNav.innerText = `@${usuarioLogueado}`;
    }

    // Fix Carga IA
    try {
        if (typeof nsfwjs !== 'undefined') {
            modeloNSFW = await nsfwjs.load();
            console.log("IA Lista");
        }
    } catch (e) { console.error("IA en espera...", e); }
    
    // Leer secretos después de cargar sesión
    leerSecretos();
}

// 2. FUNCIONES DE RENDERIZADO (RESTAURADAS)
function renderMedia(url, nsfw, id) {
    if(!url) return '';
    const blur = nsfw ? 'media-censurada' : '';
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov)/i);
    let html = `<div style="position:relative; margin:10px 0;">`;
    if(nsfw) html += `<div class="nsfw-overlay" onclick="this.nextElementSibling.classList.remove('media-censurada'); this.remove()">NSFW - VER</div>`;
    
    const clickAction = nsfw ? '' : `onclick="abrirCine('${url}')" style="cursor:zoom-in"`;
    html += isVid ? `<video src="${url}" controls class="card-img ${blur}"></video>` : `<img src="${url}" class="card-img ${blur}" ${clickAction}>`;
    return html + `</div>`;
}

function abrirCine(url) {
    const lb = document.getElementById('lightbox');
    const content = document.getElementById('lightbox-content');
    if(!lb || !content) return;
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov)/i);
    content.innerHTML = isVid ? `<video src="${url}" controls autoplay style="max-width:100%"></video>` : `<img src="${url}" style="max-width:100%">`;
    lb.style.display = 'flex';
}

// 3. LEER PUBLICACIONES
async function leerSecretos(soloMios = false) {
    let q = _supabase.from('secretos').select('*');
    
    if (soloMios) q = q.eq('usuario_nombre', usuarioLogueado);
    else if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error || !data) {
        container.innerHTML = "No hay secretos aún.";
        return;
    }

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);

    container.innerHTML = principal.map(s => {
        const susResp = respuestas.filter(r => r.padre_id === s.id).reverse();
        const autor = s.usuario_nombre && s.usuario_nombre !== 'Anónimo' ? `@${s.usuario_nombre}` : `#${s.id}`;
        
        return `<div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">${autor} [+]</span>
                <p>${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url, s.es_nsfw, s.id)}
                <div class="footer-card">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => {
                const autorR = r.usuario_nombre && r.usuario_nombre !== 'Anónimo' ? `@${r.usuario_nombre}` : `#${r.id}`;
                return `<div class="reply-card" style="margin-left:20px; border-left: 2px solid red; padding-left:10px;">
                    <span class="reply-author">${autorR} >> #${r.padre_id}</span>
                    <p>${escaparHTML(r.contenido).replace(/>>(\d+)/g, '<b>>>$1</b>')}</p>
                    ${renderMedia(r.imagen_url, r.es_nsfw, r.id)}
                    <button class="like-btn" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`}).join('')}
        </div>`;
    }).join('');
}

// 4. PUBLICAR Y CAPTCHA
function captchaResuelto(t) { 
    tokenCaptchaPost = t; 
    btnEnviar.disabled = false; 
}

function captchaRegistroResuelto(t) { 
    tokenCaptchaReg = t; 
    const btnReg = document.getElementById('btn-reg');
    if(btnReg) btnReg.disabled = false; 
}

btnEnviar.onclick = async () => {
    if (!tokenCaptchaPost) return alert("Resuelve el captcha primero.");
    btnEnviar.disabled = true;
    
    const autorPost = usuarioLogueado || 'Anónimo';

    try {
        let url = null;
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            const n = `${Date.now()}.${f.name.split('.').pop()}`;
            await _supabase.storage.from('imagenes').upload(n, f);
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        await _supabase.from('secretos').insert([{ 
            contenido: input.value, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url, 
            usuario_nombre: autorPost
        }]);

        input.value = ""; 
        cancelarPreview(); 
        cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptchaPost = null;
        btnEnviar.disabled = true;
        leerSecretos();
    } catch(e) { alert("Error al publicar"); }
    finally { btnEnviar.disabled = false; }
};

// 5. REGISTRO Y SESIÓN
async function registrarUsuario() {
    const user = document.getElementById('reg-user').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if (!tokenCaptchaReg) return alert("Resuelve el captcha de registro");

    const { error } = await _supabase.auth.signUp({
        email: email, password: pass,
        options: { data: { username: user } }
    });

    if (error) alert(error.message);
    else {
        alert("¡Cuenta creada!");
        location.reload();
    }
}

// 6. UTILIDADES
function mostrarPreview(inputElement) {
    const file = inputElement.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.style.display = "block";
            previewContainer.innerHTML = `<img src="${e.target.result}" style="max-width:100%; border-radius:12px;">
            <b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:black; color:white; padding:5px 10px; border-radius:50%;">✕</b>`;
        }
        reader.readAsDataURL(file);
    }
}
function cancelarPreview() { previewContainer.style.display = "none"; fotoInput.value = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Resp #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function toggleRegistro() { 
    const m = document.getElementById('modal-registro');
    m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}

// MODAL POLÍTICAS Y CIERRE
const modalP = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modalP.style.display = 'none';

document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modalP.style.display = 'none';
};

// INICIAR TODO
inicializar();
