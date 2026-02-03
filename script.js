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

    // Fix Carga IA: Try/Catch para evitar el error "nsfwjs is not defined"
    try {
        if (typeof nsfwjs !== 'undefined') {
            modeloNSFW = await nsfwjs.load();
            console.log("IA Lista");
        }
    } catch (e) { console.error("IA en espera...", e); }
}
inicializar();

// 2. REGISTRO CON EMAIL Y CAPTCHA
function captchaRegistroResuelto(t) { 
    tokenCaptchaReg = t; 
    document.getElementById('btn-reg').disabled = false; 
}

async function registrarUsuario() {
    const user = document.getElementById('reg-user').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if (!tokenCaptchaReg) return alert("Resuelve el captcha de registro");
    if (user.length < 3) return alert("Usuario muy corto");

    const { error } = await _supabase.auth.signUp({
        email: email,
        password: pass,
        options: { data: { username: user } }
    });

    if (error) alert(error.message);
    else {
        alert("¡Cuenta creada! Revisa tu email si activaste confirmación.");
        location.reload();
    }
}

// 3. LEER PUBLICACIONES (IDENTIDAD Y PERFIL)
async function leerSecretos(soloMios = false) {
    let q = _supabase.from('secretos').select('*');
    
    if (soloMios) q = q.eq('usuario_nombre', usuarioLogueado);
    else if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data } = await q;
    if (!data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);

    container.innerHTML = principal.map(s => {
        const susResp = respuestas.filter(r => r.padre_id === s.id).reverse();
        // Mostrar @username si existe, sino ID
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
                return `<div class="reply-card">
                    <span class="reply-author">${autorR} >> #${r.padre_id}</span>
                    <p>${escaparHTML(r.contenido).replace(/>>(\d+)/g, '<b>>>$1</b>')}</p>
                    ${renderMedia(r.imagen_url, r.es_nsfw, r.id)}
                    <button class="like-btn" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`}).join('')}
        </div>`;
    }).join('');
}

// 4. PUBLICAR Y LIKES
btnEnviar.onclick = async () => {
    if (!tokenCaptchaPost) return alert("Captcha de post!");
    btnEnviar.disabled = true;
    
    let esNSFW = await esContenidoXXX();
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
            es_nsfw: esNSFW,
            usuario_nombre: autorPost // Guardar nombre
        }]);

        input.value = ""; cancelarPreview(); cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        leerSecretos();
    } catch(e) { alert("Error"); }
    finally { btnEnviar.disabled = false; }
};

async function reaccionar(id) {
    if(localStorage.getItem('v_'+id)) return;
    const btns = document.querySelectorAll(`button[onclick="reaccionar(${id})"]`);
    btns.forEach(b => {
        let n = parseInt(b.innerText.replace('🔥 ', '')) || 0;
        b.innerHTML = `🔥 ${n + 1}`;
        b.classList.add('like-active');
    });
    localStorage.setItem('v_'+id, '1');
    await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
}

// FUNCIONES DE SOPORTE
function verMiPerfil() { leerSecretos(true); }
function toggleRegistro() { 
    const m = document.getElementById('modal-registro');
    m.style.display = m.style.display === 'none' ? 'flex' : 'none';
}
function captchaResuelto(t) { tokenCaptchaPost = t; btnEnviar.disabled = false; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Resp #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }

// MODAL POLÍTICAS (FIX CIERRE)
document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    document.getElementById('modal-politicas').style.display = 'none';
};

leerSecretos();
